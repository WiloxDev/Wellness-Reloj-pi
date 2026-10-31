import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import {
  loadConfig,
  persistWellnessPatch,
  getWiloxUnifiedConfigPath,
  getLegacyWellnessConfigPath
} from "../dist/config.js";

test("Config · Carga de defaults seguros", () => {
  const cfg = loadConfig();
  assert.equal(typeof cfg.enabled, "boolean");
  assert.equal(cfg.clock?.format, "12h");
  assert.equal(cfg.clock?.asciiStyle, "rounded");
  assert.equal(cfg.habits?.waterMinutes, 45);
  assert.equal(cfg.habits?.eyeRestMinutes, 20);
  assert.equal(cfg.habits?.stretchMinutes, 60);
});

test("Config · Persistencia atómica POSIX en settings.json y espejo retrocompatible", () => {
  const unifiedPath = getWiloxUnifiedConfigPath();
  const legacyPath = getLegacyWellnessConfigPath();

  // Aplicar parche
  const patched = persistWellnessPatch({
    clock: { format: "24h", asciiStyle: "square" },
    habits: { waterMinutes: 30 }
  });

  assert.equal(patched.clock?.format, "24h");
  assert.equal(patched.clock?.asciiStyle, "square");
  assert.equal(patched.habits?.waterMinutes, 30);

  // Verificar archivo unificado en disco
  assert.ok(fs.existsSync(unifiedPath));
  const unifiedContent = JSON.parse(fs.readFileSync(unifiedPath, "utf8"));
  assert.equal(unifiedContent.wellness?.clock?.format, "24h");
  assert.equal(unifiedContent.wellness?.clock?.asciiStyle, "square");

  // Verificar archivo espejo
  assert.ok(fs.existsSync(legacyPath));
  const legacyContent = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
  assert.equal(legacyContent.clock?.format, "24h");

  // Restaurar valores estándar
  persistWellnessPatch({
    clock: { format: "12h", asciiStyle: "rounded" },
    habits: { waterMinutes: 45 }
  });
});
