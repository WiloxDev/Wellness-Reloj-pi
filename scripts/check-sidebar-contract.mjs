#!/usr/bin/env node
/**
 * check-sidebar-contract.mjs — detector del contrato de composición del sidebar.
 *
 * Reglas (ADR-0001). Deciden solo con evidencia textual, sin falsos positivos conocidos:
 *
 *  R1 footer-opaco — el archivo escribe `parts.set("footer", …)` pero en todo el archivo no
 *      aparece `__originalRail`. Corta la cadena de delegación: otras extensiones dejan de
 *      ver el compositor de ranuras y reinstalan el suyo → cada ranura se pinta dos veces.
 *      Cubre también la reinyección de un rail ajeno cacheado.
 *  R2 doble-canal  — registra una tarjeta como parte propia (`parts.set("<id>", IDENT)`,
 *      id ≠ footer) y además envuelve `footer` renderizando ese mismo `IDENT.render(...)`.
 *      La misma tarjeta es alcanzable por dos caminos de pintado.
 *  R3 rail-robado  — hace `parts.delete("footer")` o reinyecta un footer cacheado sin
 *      comprobar antes que ese rail sea propio (ninguna comparación de identidad contra
 *      `parts.get("footer")`). Puede resucitar un compositor ya DISPOSado.
 *
 * Uso: node scripts/check-sidebar-contract.mjs <ruta> [<ruta> …]
 * Sale con código 1 si hay infracciones. Excluye fixtures de prueba (tests/, test/, *.test.*),
 * donde montar un footer pelado sin enlace es legítimo.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", "tests", "test", "__fixtures__"]);
const SRC_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx"]);

const isTestFixture = (p) => /\.test\.[cm]?[jt]sx?$/.test(p) || /(^|\/)(tests?|__fixtures__)\/./.test(p);

async function collect(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) stack.push(full);
      } else if (SRC_EXT.has(extname(e.name)) && !isTestFixture(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;
const snippet = (src, idx) => src.split("\n")[lineOf(src, idx) - 1].trim().slice(0, 110);

function analyze(path, src) {
  const findings = [];
  const footerWrites = [...src.matchAll(/parts\.set\(\s*["']footer["']/g)];
  const hasLink = /__originalRail/.test(src);
  const footerDeletes = [...src.matchAll(/parts\.delete\(\s*["']footer["']/g)];

  // R1 solo aplica a WRAPPERS creados en el propio archivo. Reinyectar un rail que el mismo
  // archivo leyó antes con parts.get("footer") no corta la cadena: ese rail ya trae la suya.
  const reinjected = new Set(
    [...src.matchAll(/parts\.get\(\s*["']footer["']\s*\)/g)].length
      ? [...src.matchAll(/(?:let|const|var)?\s*\b([A-Za-z_$][\w$]*)\s*=\s*[\w$.]*parts\.get\(\s*["']footer["']\s*\)/g)].map((r) => r[1])
      : []
  );
  if (footerWrites.length && !hasLink) {
    for (const m of footerWrites) {
      const written = /parts\.set\(\s*["']footer["']\s*,\s*([A-Za-z_$][\w$]*)/.exec(src.slice(m.index, m.index + 120))?.[1];
      if (written && reinjected.has(written)) continue;
      findings.push({
        rule: "R1 footer-opaco",
        file: path,
        line: lineOf(src, m.index),
        code: snippet(src, m.index),
        why: "Escribe footer sin exponer __originalRail: corta la cadena y otros montadores no detectan el compositor."
      });
    }
  }

  for (const m of src.matchAll(/parts\.set\(\s*["'](?!footer["'])([a-zA-Z0-9_-]+)["']\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
    const [, id, ident] = m;
    if (!footerWrites.length) continue;
    const rendersSame = new RegExp(`${ident}\\s*\\.\\s*render\\s*\\(`).test(src);
    if (!rendersSame) continue;
    findings.push({
      rule: "R2 doble-canal",
      file: path,
      line: lineOf(src, m.index),
      code: snippet(src, m.index),
      why: `La parte "${id}" se registra como parte propia y además su contenido se pinta dentro del footer envuelto.`
    });
  }

  for (const m of footerDeletes) {
    const identityCheck = /parts\.get\(\s*["']footer["']\s*\)\s*===/.test(src);
    if (identityCheck) continue;
    findings.push({
      rule: "R3 rail-robado",
      file: path,
      line: lineOf(src, m.index),
      code: snippet(src, m.index),
      why: "Elimina/reinyecta el footer sin comprobar si el rail es propio: puede resucitar un compositor ya DISPOSado."
    });
  }

  return findings;
}

const roots = process.argv.slice(2);
if (!roots.length) {
  console.error("uso: node scripts/check-sidebar-contract.mjs <ruta> […]");
  process.exit(2);
}

const files = (await Promise.all(roots.map(collect))).flat();
const findings = [];
for (const f of files) {
  try {
    findings.push(...analyze(f, await readFile(f, "utf8")));
  } catch {}
}

console.log(`# Contrato del sidebar · ${files.length} archivos analizados`);
if (!findings.length) {
  console.log("OK — sin infracciones.");
  process.exit(0);
}
for (const x of findings.sort((a, b) => a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file))) {
  console.log(`\n${x.rule}  ${x.file}:${x.line}\n  ${x.code}\n  → ${x.why}`);
}
console.log(`\n${findings.length} infracción(es). Reglas: docs/adr/0001-sidebar-composition.md`);
process.exit(1);
