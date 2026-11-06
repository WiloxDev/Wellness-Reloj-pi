/**
 * Harness de composición del sidebar.
 *
 * Piezas compartidas por las pruebas de `sidebar-dock`: terminal falso, rail de status,
 * definición de ranura, wrapper extranjero de reenvío y utilidades de inspección de la
 * cadena de delegación. Está pensado para que cualquier repo con una copia del dock pueda
 * afirmar lo mismo: **cada ranura registrada se pinta una sola vez**, sin importar cuántas
 * capas intermedia haya por encima ni en qué orden se montaron.
 */

export const GENTLE_STATE = Symbol.for("gentle-pi.experimental-sidebar.state");
export const GENTLE_SLOTS = Symbol.for("gentle-pi.community.wiloxdev.sidebar-slots");

export type Rail = Record<string, any>;
export type DockModule = { mountSidebarSlot: (tui: any, slot: any) => (() => void) | undefined };

/** Registro global de ranuras: compartido entre copias del dock, como en runtime real. */
export const registry = (): Map<string, Rail> => {
  const bus = globalThis as any;
  return (bus[GENTLE_SLOTS] ??= new Map<string, Rail>());
};

/** Terminal mínimo con un `footer` base ya instalado. */
export const freshTui = (footer: Rail) => {
  const parts = new Map<string, Rail>([["footer", footer]]);
  return {
    parts,
    terminal: { [GENTLE_STATE]: { active: true, ownsHost: () => true, parts } }
  } as any;
};

export const statusRail = (): Rail => ({
  render: () => ["Status"],
  digest: () => "status",
  invalidate() {}
});

export const slotDef = (id: string, order: number, lines: string[]): Rail => ({
  id,
  order: () => order,
  enabled: () => true,
  render: () => lines
});

/**
 * Capa de otra extensión: envuelve el rail visible y reenvía hacia abajo.
 * `__originalRail` es el enlace de delegación que hace posible detectar el compositor.
 */
export const forwardingWrapper = (inner: Rail): Rail => ({
  __isCpamcDecorated: true,
  __originalRail: inner,
  render: (width: number) => inner.render(width),
  digest: () => inner.digest(),
  handleMouse: (evt: any, y?: number) => inner.handleMouse?.(evt, y),
  dispose: () => inner.dispose?.()
});

export const lineCount = (lines: string[], needle: string) =>
  lines.filter((l) => l.includes(needle)).length;

/** Cuántos compositores de ranuras hay alcanzables, con guarda de visitas ante ciclos. */
export const compositorsInChain = (rail: Rail): number => {
  const seen = new Set<Rail>();
  let node: Rail | undefined = rail;
  let found = 0;
  while (node && !seen.has(node)) {
    seen.add(node);
    if (node.__isWiloxSlotsCompositor) found += 1;
    node = node.__originalRail;
  }
  return found;
};

/**
 * Segunda copia real del dock, como módulo independiente.
 *
 * En runtime, Wellness-Reloj-pi y gentle-context-lens cargan cada uno su propia copia de
 * `sidebar-dock` y comparten únicamente el registro global. Aquí se reproduce esa forma con
 * dos instancias del mismo artefacto generado: la comprobación del guardia es idéntica porque
 * las fuentes son byte a byte iguales — la igualdad entre los dos repos la vigila el gate de
 * paridad (Wellness-Reloj-pi#1), no este archivo.
 */
export const loadSecondDockCopy = async (): Promise<DockModule> => {
  const url = new URL("../dist/sidebar-dock.js", import.meta.url);
  const source = await import("node:fs/promises").then((fs) => fs.readFile(url, "utf8"));
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
};
