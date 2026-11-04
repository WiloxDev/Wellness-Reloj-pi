#!/usr/bin/env bash
# ==============================================================================
# Wellness & Reloj - Instalador Canónico para Gentle-Shell
# ==============================================================================
set -e

REPO_URL="https://github.com/WiloxDev/Wellness-Reloj-pi.git"
TARGET_EXT_DIR="$HOME/.gentle-shell/agent/extensions/wellness-reloj"
EXT_BASE="$(dirname "$TARGET_EXT_DIR")"

echo "⏰ Instalando 'Wellness & Reloj' en Gentle-Shell..."

mkdir -p "$EXT_BASE"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$SCRIPT_DIR" != "$TARGET_EXT_DIR" ] && [ -f "$SCRIPT_DIR/package.json" ]; then
    echo "📦 Enlazando/copiando extensión local a $TARGET_EXT_DIR..."
    rm -rf "$TARGET_EXT_DIR"
    cp -r "$SCRIPT_DIR" "$TARGET_EXT_DIR"
elif [ -d "$TARGET_EXT_DIR/.git" ]; then
    echo "🔄 Actualizando versión existente en $TARGET_EXT_DIR..."
    git -C "$TARGET_EXT_DIR" pull --ff-only 2>/dev/null || true
elif [ ! -d "$TARGET_EXT_DIR" ]; then
    echo "📥 Clonando extensión en $TARGET_EXT_DIR..."
    git clone "$REPO_URL" "$TARGET_EXT_DIR"
fi

if command -v npm >/dev/null 2>&1; then
    echo "⚙️  Compilando TypeScript..."
    cd "$TARGET_EXT_DIR"
    npm install --silent --no-audit --no-fund
    npm run build --silent
fi

UNIFIED_CONFIG_DIR="$HOME/.config/wiloxdev"
UNIFIED_CONFIG="$UNIFIED_CONFIG_DIR/settings.json"
LEGACY_CONFIG="$HOME/.wellnessrc.json"

mkdir -p "$UNIFIED_CONFIG_DIR"

if command -v node >/dev/null 2>&1; then
    node -e "
    const fs = require('fs');
    const path = '$UNIFIED_CONFIG';
    const legacyPath = '$LEGACY_CONFIG';
    
    let unified = {};
    if (fs.existsSync(path)) {
        try { unified = JSON.parse(fs.readFileSync(path, 'utf8')); } catch {}
    }
    unified.schema = unified.schema || 'wiloxdev.unified/v1';
    unified.wellness = {
        enabled: true,
        clock: { format: '12h', showDate: true, locale: 'es', asciiStyle: 'rounded' },
        habits: { waterMinutes: 45, eyeRestMinutes: 20, stretchMinutes: 60, resetOnClick: true },
        schedule: { breakfast: '08:30', lunch: '13:30', afternoonSnack: '17:00', dinner: '21:00', rest: '23:00' },
        appearance: { theme: 'gentle-default', layout: 'auto', sidebarPriority: 25 },
        ...(unified.wellness || {})
    };
    
    const tmp = path + '.' + require('crypto').randomUUID() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(unified, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(tmp, path);

    if (!fs.existsSync(legacyPath)) {
        const tmpLegacy = legacyPath + '.' + require('crypto').randomUUID() + '.tmp';
        fs.writeFileSync(tmpLegacy, JSON.stringify(unified.wellness, null, 2) + '\n', { mode: 0o600 });
        fs.renameSync(tmpLegacy, legacyPath);
    }
    " 2>/dev/null || true
fi

echo ""
echo "✨ ¡Instalación completada con éxito en Gentle-Shell!"
echo "📂 Ubicación: $TARGET_EXT_DIR"
echo "⚙️  Configuración: $UNIFIED_CONFIG"
echo ""
echo "💡 Control interactivo: Escribe /wellness en Gentle-Shell para gestionar hábitos."