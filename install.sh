#!/usr/bin/env bash
# ==============================================================================
# Wellness & Reloj - Auto-Installer para Gentle-Pi
# ==============================================================================
set -e

REPO_URL="https://github.com/WiloxDev/Wellness-Reloj-pi.git"
DEFAULT_EXT_DIR="$HOME/.pi/agent/extensions/wellness-reloj"

echo "⏰ Instalando 'Wellness & Reloj' para Gentle-Pi..."

# 1. Determinar el directorio de extensiones de Pi
PI_EXT_BASE="$HOME/.pi/agent/extensions"
mkdir -p "$PI_EXT_BASE"

# 2. Clonar o Actualizar el Repositorio
if [ -d "$DEFAULT_EXT_DIR/.git" ]; then
    echo "🔄 Actualizando versión existente en $DEFAULT_EXT_DIR..."
    git -C "$DEFAULT_EXT_DIR" pull --ff-only
else
    echo "📥 Clonando extensión en $DEFAULT_EXT_DIR..."
    rm -rf "$DEFAULT_EXT_DIR"
    git clone "$REPO_URL" "$DEFAULT_EXT_DIR"
fi

# 3. Compilar TypeScript si npm está disponible
if command -v npm >/dev/null 2>&1; then
    echo "🔨 Compilando extensión..."
    cd "$DEFAULT_EXT_DIR"
    npm install --silent --no-audit --no-fund
    npm run build --silent
fi

# 4. Crear configuración por defecto si no existe
USER_CONFIG="$HOME/.wellnessrc.json"
if [ ! -f "$USER_CONFIG" ]; then
    echo "⚙️  Creando archivo de configuración personal en $USER_CONFIG..."
    cat << 'EOF' > "$USER_CONFIG"
{
  "clock": {
    "format": "12h",
    "locale": "es",
    "asciiStyle": "rounded",
    "showDate": true
  },
  "habits": {
    "waterMinutes": 45,
    "eyeRestMinutes": 20,
    "stretchMinutes": 60,
    "resetOnClick": true
  },
  "schedule": {
    "breakfast": "08:30",
    "lunch": "13:30",
    "afternoonSnack": "17:00",
    "dinner": "21:00",
    "rest": "23:00"
  },
  "appearance": {
    "theme": "gentle-default",
    "layout": "auto"
  }
}
EOF
fi

echo ""
echo "✅ ¡Instalación completada con éxito!"
echo "📍 Ubicación: $DEFAULT_EXT_DIR"
echo "⚙️ Configuración: $USER_CONFIG (Totalmente personalizable)"
echo "✨ Al abrir tu próxima sesión de Gentle-Pi, el widget se montará en tu sidebar derecho."
