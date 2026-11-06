#!/usr/bin/env bash
# contract-gate.sh — puerta de contrato del dock (ADR-0001).
#
# Ejecuta la suite canónica de este repo. Con DOCK_SUSTITUTO puede evaluar LA COPIA DE OTRA
# EXTENSIÓN dentro de esta misma suite: la copia sustituta se compila y se prueba igual que la
# propia. Así dos forks del mismo módulo no pueden divergir en silencio.
#
#   ./scripts/contract-gate.sh                                  # mi copia
#   ./scripts/contract-gate.sh ../otro-repo/src/sidebar-dock.ts # la copia ajena
#
# Además verifica que dist/ sea exactamente lo que src/ compila (clase de bug: "arreglé src,
# sigue cargando dist").
set -euo pipefail
cd "$(dirname "$0")/.."

CANON="src/sidebar-dock.ts"
SUBSTITUTE="${1:-}"

# --- 1. Frescura del artefacto generado -----------------------------------------------------
if [[ -d dist ]]; then
echo "== dist fresco contra src =="
rm -rf /tmp/dist-fresh
npx tsc --outDir /tmp/dist-fresh --declaration false --declarationMap false --sourceMap false
if diff -r -q --exclude='*.d.ts' --exclude='*.map' /tmp/dist-fresh dist >/dev/null; then
  echo "OK — dist coincide con src"
else
  echo "FALLO — dist está obsoleto respecto a src"; diff -r -q --exclude='*.d.ts' --exclude='*.map' /tmp/dist-fresh dist || true; exit 1
fi
else
echo "== sin dist/ en el árbol: se generará con npm test (clone limpio) =="
fi

# --- 2. Suite canónica con la copia propia --------------------------------------------------
echo "== suite canónica (copia propia) =="
npm test --silent

# --- 3. Suite canónica con la copia sustituta (si se pidió) ---------------------------------
if [[ -n "$SUBSTITUTE" ]]; then
  [[ -f "$SUBSTITUTE" ]] || { echo "no existe la copia sustituta: $SUBSTITUTE"; exit 1; }
  echo "== suite canónica con copia sustituta: $SUBSTITUTE =="
  backup="$(mktemp)"
  cp "$CANON" "$backup"
  # restaurar si algo falla, para no dejar el repo con la copia ajena
  trap 'cp "$backup" "$CANON"; npm run build --silent >/dev/null 2>&1 || true' EXIT
  cp "$SUBSTITUTE" "$CANON"
  npm test --silent
  cp "$backup" "$CANON"
  npm run build --silent
  trap - EXIT
  echo "OK — la copia sustituta cumple el contrato"
fi
