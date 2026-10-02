# ⏰ Wellness & Reloj para Gentle-Pi

> Widget de reloj digital ASCII redondeado y monitor de hábitos ergonómicos para el sidebar derecho de Gentle-Pi. Aislado, ligero, sin dependencias pesadas y protegido contra actualizaciones del anfitrión.

---

## ✨ Características

- 🕒 **Reloj Digital 3x3**: Glifos redondeados de alta precisión ANSI (`╭─╮`, `│ │`, `╰─╯`) en formato 12h o 24h con fecha en español.
- 💧 **Monitor de Hidratación**: Temporizador decreciente configurable para recordar beber agua.
- 👁 **Regla 20-20-20 para la Vista**: Alertas de fatiga visual para cuidar tus ojos.
- 🧘 **Pausas Activas**: Temporizador para levantarse y estirarse.
- 🍴 **Agenda de Comidas**: Recordatorios dinámicos para Desayuno, Almuerzo, Merienda y Cena.
- 🛡 **A prueba de Actualizaciones**: Vive en el directorio de extensiones de usuario de Pi. Actualizar Gentle-Pi **nunca borra** ni rompe tu configuración.
- 🎨 **Totalmente Personalizable**: Tiempos, cronogramas y estilos modificables mediante `~/.wellnessrc.json`.

---

## 🚀 Instalación Rápida (1 Solo Comando)

Cualquier usuario de Gentle-Pi puede instalarlo con este comando en su terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/WiloxDev/Wellness-Reloj-pi/main/install.sh | bash
```

O clonándolo directamente en la carpeta de extensiones de Pi:

```bash
git clone https://github.com/WiloxDev/Wellness-Reloj-pi.git ~/.pi/agent/extensions/wellness-reloj
cd ~/.pi/agent/extensions/wellness-reloj
npm install && npm run build
```

---

## ⚙️ Personalización (`~/.wellnessrc.json`)

El instalador genera automáticamente tu archivo de configuración en tu carpeta de usuario (`~/.wellnessrc.json`). Puedes editarlo en cualquier momento:

```json
{
  "clock": {
    "format": "12h",           // "12h" o "24h"
    "locale": "es",            // "es" o "en"
    "asciiStyle": "rounded",   // "rounded" o "square"
    "showDate": true
  },
  "habits": {
    "waterMinutes": 45,        // Cada cuánto recordar agua
    "eyeRestMinutes": 20,      // Descanso visual
    "stretchMinutes": 60,      // Pausa activa / estiramiento
    "resetOnClick": true       // Clic sobre la tarjeta reinicia los contadores
  },
  "schedule": {
    "breakfast": "08:30",
    "lunch": "13:30",
    "afternoonSnack": "17:00",
    "dinner": "21:00",
    "rest": "23:00"
  },
  "appearance": {
    "layout": "auto"           // "auto" (conmuta según ancho), "side-by-side" o "stacked"
  }
}
```

---

## 🕹 Comandos en Gentle-Pi

Dentro de la sesión de Gentle-Pi tienes disponible el comando `/wellness`:

- `/wellness reset` — Reinicia todos los temporizadores a cero.
- `/wellness water` — Reinicia el contador de agua.
- `/wellness eyes` — Reinicia el contador de descanso visual.
- `/wellness stretch` — Reinicia el contador de pausa activa.

---

## 📦 Arquitectura y Desarrollo

```bash
# Compilar cambios de TypeScript
npm run build

# Modo watch durante desarrollo
npm run watch
```

## 📄 Licencia

MIT © [WiloxDev](https://github.com/WiloxDev)
