# ADR-0001 — Composición del rail del sidebar

- **Estado:** aceptada
- **Fecha:** 2026-11-05
- **Contexto:** `Wellness-Reloj-pi` y `gentle-context-lens` duplicaron `PomoReloj Bigote` y la fila
  de porcentaje en Gentle Shell. Causa: cada extensión instala un **compositor de ranuras** en
  `terminal.state.parts["footer"]` y detecta si ya existe uno mirando **solo la capa visible**.
  Cuando una tercera extensión mete un wrapper por encima, la capa visible ya no lleva el marcador,
  el detector falla y se monta un segundo compositor que recorre el mismo registro global.

## Decisiones normativas

### R1 — Un solo compositor de ranuras por terminal
La detección **recorre la cadena de delegación**; prohibido comprobar únicamente la capa visible.

```ts
// Correcto (implementado en sidebar-dock.ts)
if (!originalRail || findSlotsCompositor(originalRail)) { /* montar */ }
```

Contraejemplo real: `discord-pi/src/index.ts:123` decide con `!(originalFooter as any).__discordAttached`
sobre la capa visible y pinta la tarjeta de Discord dos veces si hay una capa por encima.

### R2 — Todo decorador de `footer` expone `__originalRail`
Quien envuelve el rail visible debe dejar enlace hacia la capa que envolvió. Sin enlace, las
extensiones montadas después no pueden verte y reinstalan su compositor.

Contraejemplos reales: `discord-pi/src/index.ts:114-123` (wrapper sin enlace) y
`center-control-gentle/index.ts:784,801` (reinyecta `cachedFooterRail` sin enlace).

### R3 — Prohibido el doble canal de pintado
Una tarjeta se registra **una** vez. Es infracción registrarla como parte propia y además pintarla
dentro del `footer` envuelto.

Contraejemplo real: `discord-pi/src/index.ts:87` (`parts.set("discord", railComponent)`) más
`discord-pi/src/index.ts:96` (`railComponent.render(width)` dentro del decorador).

> Nota: `ui.setWidget(id, factory)` **no** cuenta como segundo canal cuando la factory solo captura
> el `tui` y monta ranuras (patrón `createZeroChatWidget` en Wellness y Context Lens).

### R4 — Nadie cachea ni reinyecta un `footer` ajeno
`dispose` solo restaura si todavía es dueño: `parts.get("footer") === loQueYoInstale`. Prohibido
guardar el `footer` de otra extensión para devolverlo después.

Contraejemplo real: `center-control-gentle/index.ts:766,784,801` cicla modos y reinyecta un rail que
otra extensión ya DISPOSó → el compositor revive con sus ranuras ya borradas.

### R5 — Todo objeto entregado a `setWidget` cumple `Component`
`invalidate` es obligatorio. Faltar provoca que Pi abandone el **registro completo** de widgets del
turno (`ExtensionRunner._bindDirectComponentInvalidate` propaga el error) y con él el enganche de
mount del sidebar. Evidencia local: `gentle-context-lens/src/index.ts:84` (TS2769, resuelto).

## Diccionario de marcadores (P1.2)

| Símbolo / marcador | Dónde | Lo crea | Lo consume |
|---|---|---|---|
| `Symbol.for("gentle-pi.community.wiloxdev.sidebar-slots")` | `globalThis` | el primer dock que monta | ambos docks (registro compartido de ranuras) |
| `__isWiloxSlotsCompositor` | compositor | `sidebar-dock.ts` | `findSlotsCompositor` (guarda de idempotencia) |
| `__originalRail` | capa envoltora | decoradores cooperativos | recorrido de cadena |
| `Symbol.for("gentle-pi.experimental-sidebar.state")` | `tui.terminal` | gentle-shell | docks y decoradores (acceso a `parts`) |
| `__isCpamcDecorated` / `__cpamcHooked` | wrapper y terminal | `cpamc-auto-switcher/src/adapter.ts:694,797` | su propia anti-reenvoltura y banderas de pintado |
| `__discordAttached` | decoratedFooter | `discord-pi/src/index.ts:115-120` | solo él (invisible para otros → R1/R2) |

## Cómo se comprueba

- Unitaria: `tests/sidebar-dock.test.ts` + `tests/sidebar-composition-harness.ts` (9 casos, sin
  dependencia de repos hermanos).
- Estructural: `node scripts/check-sidebar-contract.mjs <rutas>` — mismas reglas, decidable por
  texto, apto para CI. Debe alertar `discord-pi` y `center-control-gentle` y callar ante
  Wellness, Context Lens, CPAMC y usage-sidebar.

## Consecuencias

- Una extensión que ignore R1/R2 volverá a producir duplicación; por eso el detector vive en CI.
- Las dos copias del dock siguen existiendo; su igualdad se vigila aparte (Wellness-Reloj-pi#1).
- El contrato es textual porque el estado compartido del sidebar no es público: si gentle-shell lo
  expone (issue upstream #2923), R1/R2 se convierten en invariantes del host y este ADR se retira.
