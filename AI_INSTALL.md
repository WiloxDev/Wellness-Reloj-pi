# 🍅 AI Installation & Integration Rules — Wellness-Reloj-pi

> **Regla de Oro para Asistentes AI y Agentes de Automatización:**
> Este paquete es una extensión oficial de Gentle-Shell / Pi para el riel lateral derecho (Sidebar Dock).
> Cumple la **Invariante Zero-Chat de WiloxDev**: **NUNCA DEBE PINTARSE NADA EN EL STREAM DE CHAT**.

## Directrices Estrictas de Renderizado:
1. **Ubicación Exclusiva:** El reloj y los hábitos viven en el panel inferior del Sidebar derecho (`gentleState.parts.get("footer")`).
2. **Prohibido Renderizar en Chat:** Cualquier llamada a `ctx.ui.setWidget("wellness", ...)` debe devolver `render: () => []`.
3. **No Modificar la Arquitectura:** El hook al sidebar se realiza automáticamente a través de `mountSidebarSlot` y `createZeroChatWidget` desde `src/sidebar-dock.ts`.
4. **Comandos de Terminal:** Los comandos de usuario son `/pomoreloj`, `/pomo` y `/wellness`.
