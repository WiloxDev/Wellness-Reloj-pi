import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SIDEBAR_SLOTS_SLOT,
  mountSidebarSlot
} from "../dist/sidebar-dock.js";

test("Sidebar Dock · Registro y composición de múltiples ranuras ordenadas", () => {
  const GENTLE_STATE_SLOT = Symbol.for("gentle-pi.experimental-sidebar.state");

  const originalFooter = {
    render: (_width: number) => ["Status: Connected · Model: Gemini"],
    digest: () => "status:active"
  };

  const fakeState = {
    active: true,
    ownsHost: () => true,
    parts: new Map<string, any>([["footer", originalFooter]])
  };

  const fakeTui = {
    terminal: {
      [GENTLE_STATE_SLOT]: fakeState
    }
  };

  // 1. Montar ranura B con prioridad 30 (debe ir abajo)
  const slotB: any = {
    id: "slot-b",
    title: "Slot B (Cuota)",
    order: () => 30,
    enabled: () => true,
    render: (_w: number) => ["Tarjeta B: Cuota 90%"]
  };
  mountSidebarSlot(fakeTui, slotB);

  // 2. Montar ranura A con prioridad 20 (debe ir arriba)
  const slotA: any = {
    id: "slot-a",
    title: "Slot A (Wellness)",
    order: () => 20,
    enabled: () => true,
    render: (_w: number) => ["Tarjeta A: Wellness 45m"]
  };
  mountSidebarSlot(fakeTui, slotA);

  const compositor = fakeState.parts.get("footer");
  assert.ok(compositor, "Debe existir el compositor en footer");
  assert.equal(compositor.__isWiloxSlotsCompositor, true);

  // Renderizar a 38 columnas
  const rendered = compositor.render(38);

  // Invariante de orden: Status (arriba) -> Ranura A (20) -> Ranura B (30)
  assert.equal(rendered[0], "Status: Connected · Model: Gemini");
  assert.equal(rendered[1], ""); // Separador limpio
  assert.equal(rendered[2], "Tarjeta A: Wellness 45m");
  assert.equal(rendered[3], ""); // Separador limpio
  assert.equal(rendered[4], "Tarjeta B: Cuota 90%");

  // Digest compuesto reactivo
  const digest = compositor.digest();
  assert.ok(digest.includes("status:active"));
  assert.ok(digest.includes("slot-a:20"));
  assert.ok(digest.includes("slot-b:30"));
});

test("Sidebar Dock · Despacho de clics interactivos por coordenadas relativas", () => {
  const GENTLE_STATE_SLOT = Symbol.for("gentle-pi.experimental-sidebar.state");

  let slotAClicked = false;
  let slotBClicked = false;
  let originalFooterClicked = false;

  const originalFooter = {
    render: () => ["Línea Status 0", "Línea Status 1"], // altura = 2 (y=0, y=1)
    handleMouse: (_evt: any) => {
      originalFooterClicked = true;
      return true;
    }
  };

  const fakeState = {
    active: true,
    ownsHost: () => true,
    parts: new Map<string, any>([["footer", originalFooter]])
  };

  const fakeTui = {
    terminal: {
      [GENTLE_STATE_SLOT]: fakeState
    }
  };

  // Status: líneas 0 y 1
  // Separador: línea 2
  // Slot A: línea 3 (altura = 1)
  const slotA: any = {
    id: "wellness",
    title: "Wellness",
    order: () => 10,
    enabled: () => true,
    render: () => ["Wellness Card"],
    handleMouse: (_evt, localY) => {
      assert.equal(localY, 0, "El clic local en Slot A debe tener localY = 0");
      slotAClicked = true;
      return true;
    }
  };
  mountSidebarSlot(fakeTui, slotA);

  const compositor = fakeState.parts.get("footer");
  // Renderizar para calcular metadata de alturas
  compositor.render(38);

  // Clic en Status original (y = 0)
  compositor.handleMouse({ y: 0, type: "click" });
  assert.equal(originalFooterClicked, true);

  // Clic en Slot A (y = 3)
  compositor.handleMouse({ y: 3, type: "click" });
  assert.equal(slotAClicked, true);
});

// ---------------------------------------------------------------------------
// Regresión: composición idempotente cuando otra extensión envuelve el footer
// ---------------------------------------------------------------------------

// El compositor de Context Lens es la segunda copia real que provoca el defecto.
// Se importa dinámicamente: si el repositorio hermano no está en este checkout
// (p. ej. CI de Wellness en solitario), los casos mixtos se omiten en vez de fallar.
let mountLensSlot: ((tui: any, slot: any) => () => void) | null = null;
try {
  const lensDock = await import("../../../gentle-context-lens/src/sidebar-dock.ts");
  mountLensSlot = lensDock.mountSidebarSlot;
} catch {
  mountLensSlot = null;
}
const LENS_SKIP = mountLensSlot ? false : "Context Lens no acompaña a este checkout";

const GENTLE_STATE = Symbol.for("gentle-pi.experimental-sidebar.state");
const GENTLE_SLOTS = Symbol.for("gentle-pi.community.wiloxdev.sidebar-slots");

type Rail = Record<string, any>;

const registry = (): Map<string, Rail> => {
  const bus = globalThis as any;
  return (bus[GENTLE_SLOTS] ??= new Map<string, Rail>());
};
const freshTui = (footer: Rail) => {
  const parts = new Map<string, Rail>([["footer", footer]]);
  return { parts, terminal: { [GENTLE_STATE]: { active: true, ownsHost: () => true, parts } } } as any;
};
const statusRail = (): Rail => ({ render: () => ["Status"], digest: () => "status", invalidate() {} });
const slotDef = (id: string, order: number, lines: string[]): Rail =>
  ({ id, order: () => order, enabled: () => true, render: () => lines });
const forwardingWrapper = (inner: Rail): Rail => ({
  __isCpamcDecorated: true,
  __originalRail: inner,
  render: (width: number) => inner.render(width),
  digest: () => inner.digest(),
  handleMouse: (evt: any, y?: number) => inner.handleMouse?.(evt, y),
  dispose: () => inner.dispose?.()
});
const lineCount = (lines: string[], needle: string) => lines.filter((l) => l.includes(needle)).length;
const compositorsInChain = (rail: Rail) => {
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

test("Sidebar Dock · Composición idempotente con wrapper extranjero (Wellness primero)", { skip: LENS_SKIP }, () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offWellness = mountSidebarSlot(tui, slotDef("w-pomo", 10, ["PomoReloj Bigote"]) as any);
  const outer = forwardingWrapper(tui.parts.get("footer") as Rail);
  tui.parts.set("footer", outer);
  const offLens = mountLensSlot!(tui, slotDef("l-hud", 20, ["Tools 3% | Chat 2%"]) as any);

  const rail = tui.parts.get("footer") as Rail;
  assert.equal(rail, outer, "El wrapper extranjero debe conservar la identidad del footer");
  assert.equal(compositorsInChain(rail), 1, "No debe crearse un segundo compositor");

  const lines = rail.render(38);
  assert.equal(lineCount(lines, "Status"), 1);
  assert.equal(lineCount(lines, "PomoReloj Bigote"), 1);
  assert.equal(lineCount(lines, "Tools 3% | Chat 2%"), 1);

  offWellness?.();
  offLens?.();
  registry().clear();
});

test("Sidebar Dock · Composición idempotente con wrapper extranjero (Context Lens primero)", { skip: LENS_SKIP }, () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offLens = mountLensSlot!(tui, slotDef("l-hud2", 10, ["Tools 3% | Chat 2%"]) as any);
  const outer = forwardingWrapper(tui.parts.get("footer") as Rail);
  tui.parts.set("footer", outer);
  const offWellness = mountSidebarSlot(tui, slotDef("w-pomo2", 20, ["PomoReloj Bigote"]) as any);

  const rail = tui.parts.get("footer") as Rail;
  assert.equal(compositorsInChain(rail), 1);
  const lines = rail.render(38);
  assert.equal(lineCount(lines, "PomoReloj Bigote"), 1);
  assert.equal(lineCount(lines, "Tools 3% | Chat 2%"), 1);

  offLens?.();
  offWellness?.();
  registry().clear();
});

test("Sidebar Dock · Montajes repetidos no acumulan compositores ni ranuras", () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offA = mountSidebarSlot(tui, slotDef("dup", 10, ["Unica"]) as any);
  mountSidebarSlot(tui, slotDef("dup", 10, ["Unica"]) as any);

  const rail = tui.parts.get("footer") as Rail;
  assert.equal(compositorsInChain(rail), 1);
  assert.equal(lineCount(rail.render(38), "Unica"), 1);

  offA?.();
  registry().clear();
});

test("Sidebar Dock · Cadena cíclica: detección acotada y compositor único", () => {
  registry().clear();
  const base: Rail = { ...statusRail(), __originalRail: undefined as any };
  const a: Rail = forwardingWrapper(base);
  const b: Rail = forwardingWrapper(a);
  a.__originalRail = b;
  const tui = freshTui(a);
  const off = mountSidebarSlot(tui, slotDef("cyc", 10, ["Ciclo"]) as any);

  const rail = tui.parts.get("footer") as Rail;
  assert.equal(compositorsInChain(rail), 1, "La búsqueda debe terminar y detectar sin duplicar");
  assert.equal(lineCount(rail.render(38), "Ciclo"), 1);

  off?.();
  registry().clear();
});

test("Sidebar Dock · Cadena cíclica con compositor alcanzable evita reenvolver", { skip: LENS_SKIP }, () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offInner = mountSidebarSlot(tui, slotDef("cyc2", 10, ["Interno"]) as any);
  const compositor = tui.parts.get("footer") as Rail;

  // Capa extranjera por encima del compositor, con delegación recíproca (ciclo real
  // entre ambas capas) que mantiene el compositor alcanzable desde la capa visible.
  const outer = forwardingWrapper(compositor);
  compositor.__originalRail = outer;
  tui.parts.set("footer", outer);

  const offOther = mountLensSlot!(tui, slotDef("cyc3", 20, ["Externo"]) as any);
  const rail = tui.parts.get("footer") as Rail;
  assert.equal(rail, outer, "El wrapper externo debe permanecer instalado");
  assert.equal(compositorsInChain(rail), 1);
  const lines = rail.render(38);
  assert.equal(lineCount(lines, "Interno"), 1);
  assert.equal(lineCount(lines, "Externo"), 1);

  offInner?.();
  offOther?.();
  registry().clear();
});

test("Sidebar Dock · Footer reemplazado recibe un compositor en la base actual", { skip: LENS_SKIP }, () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offOld = mountSidebarSlot(tui, slotDef("repl", 10, ["Original"]) as any);
  const detached = tui.parts.get("footer") as Rail;

  const freshBase = statusRail();
  tui.parts.set("footer", freshBase);
  const offNew = mountLensSlot!(tui, slotDef("repl-new", 10, ["Nueva"]) as any);

  const rail = tui.parts.get("footer") as Rail;
  assert.notEqual(rail, detached, "El compositor anterior queda desligado de la base actual");
  assert.equal(rail.__isWiloxSlotsCompositor, true, "La base actual debe integrar un compositor");
  assert.equal(lineCount(rail.render(38), "Nueva"), 1);

  offOld?.();
  offNew?.();
  registry().clear();
});

test("Sidebar Dock · Desmontar conserva un footer ajeno y limpia las ranuras", { skip: LENS_SKIP }, () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offWellness = mountSidebarSlot(tui, slotDef("dsp", 10, ["Pomo"]) as any);
  const outer = forwardingWrapper(tui.parts.get("footer") as Rail);
  tui.parts.set("footer", outer);
  const offLens = mountLensSlot!(tui, slotDef("dsp2", 20, ["Lens"]) as any);

  const compositor = (tui.parts.get("footer") as Rail).__originalRail;
  offWellness?.();
  offLens?.();
  registry().clear();
  compositor.dispose?.();

  assert.equal(tui.parts.get("footer"), outer, "No debe despojar el wrapper extranjero");
  assert.equal(lineCount((tui.parts.get("footer") as Rail).render(38), "Pomo"), 0);

  tui.parts.set("footer", (tui.parts.get("footer") as Rail).__originalRail);
  const plain = tui.parts.get("footer") as Rail;
  if (plain.__isWiloxSlotsCompositor) plain.dispose?.();
});
