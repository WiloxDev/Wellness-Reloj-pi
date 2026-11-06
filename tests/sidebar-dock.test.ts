import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SIDEBAR_SLOTS_SLOT,
  mountSidebarSlot,
  inspectSidebarChain
} from "../dist/sidebar-dock.js";
import type { Rail } from "./sidebar-composition-harness.ts";
import {
  forwardingWrapper,
  freshTui,
  lineCount,
  loadSecondDockCopy,
  registry,
  slotDef,
  statusRail,
  compositorsInChain
} from "./sidebar-composition-harness.ts";

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
// Regresión: composición idempotente cuando otra extensión envuelve el footer.
// Dos instancias independientes del dock comparten solo el registro global, que
// es exactamente la forma en que Wellness-Reloj-pi y gentle-context-lens llegan
// al sidebar en runtime. Ya no se importa el repo hermano: el suite vale solo.
// ---------------------------------------------------------------------------

const secondDock = await loadSecondDockCopy();
const mountSecondSlot = secondDock.mountSidebarSlot;

test("Sidebar Dock · Composición idempotente con wrapper extranjero (copia A primero)", () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offA = mountSidebarSlot(tui, slotDef("w-pomo", 10, ["PomoReloj Bigote"]) as any);
  const outer = forwardingWrapper(tui.parts.get("footer") as Rail);
  tui.parts.set("footer", outer);
  const offB = mountSecondSlot(tui, slotDef("l-hud", 20, ["Tools 3% | Chat 2%"]) as any);

  const rail = tui.parts.get("footer") as Rail;
  assert.equal(rail, outer, "El wrapper extranjero debe conservar la identidad del footer");
  assert.equal(compositorsInChain(rail), 1, "No debe crearse un segundo compositor");

  const lines = rail.render(38);
  assert.equal(lineCount(lines, "Status"), 1);
  assert.equal(lineCount(lines, "PomoReloj Bigote"), 1);
  assert.equal(lineCount(lines, "Tools 3% | Chat 2%"), 1);

  offA?.();
  offB?.();
  registry().clear();
});

test("Sidebar Dock · Composición idempotente con wrapper extranjero (copia B primero)", () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offB = mountSecondSlot(tui, slotDef("l-hud2", 10, ["Tools 3% | Chat 2%"]) as any);
  const outer = forwardingWrapper(tui.parts.get("footer") as Rail);
  tui.parts.set("footer", outer);
  const offA = mountSidebarSlot(tui, slotDef("w-pomo2", 20, ["PomoReloj Bigote"]) as any);

  const rail = tui.parts.get("footer") as Rail;
  assert.equal(compositorsInChain(rail), 1);
  const lines = rail.render(38);
  assert.equal(lineCount(lines, "PomoReloj Bigote"), 1);
  assert.equal(lineCount(lines, "Tools 3% | Chat 2%"), 1);

  offB?.();
  offA?.();
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

test("Sidebar Dock · Cadena cíclica con compositor alcanzable evita reenvolver", () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offInner = mountSidebarSlot(tui, slotDef("cyc2", 10, ["Interno"]) as any);
  const compositor = tui.parts.get("footer") as Rail;

  // Capa extranjera por encima del compositor, con delegación recíproca (ciclo real
  // entre ambas capas) que mantiene el compositor alcanzable desde la capa visible.
  const outer = forwardingWrapper(compositor);
  compositor.__originalRail = outer;
  tui.parts.set("footer", outer);

  const offOther = mountSecondSlot(tui, slotDef("cyc3", 20, ["Externo"]) as any);
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

test("Sidebar Dock · Footer reemplazado recibe un compositor en la base actual", () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offOld = mountSidebarSlot(tui, slotDef("repl", 10, ["Original"]) as any);
  const detached = tui.parts.get("footer") as Rail;

  const freshBase = statusRail();
  tui.parts.set("footer", freshBase);
  const offNew = mountSecondSlot(tui, slotDef("repl-new", 10, ["Nueva"]) as any);

  const rail = tui.parts.get("footer") as Rail;
  assert.notEqual(rail, detached, "El compositor anterior queda desligado de la base actual");
  assert.equal(rail.__isWiloxSlotsCompositor, true, "La base actual debe integrar un compositor");
  assert.equal(lineCount(rail.render(38), "Nueva"), 1);

  offOld?.();
  offNew?.();
  registry().clear();
});

test("Sidebar Dock · Patrón extranjero de caché/reinyección (center-control-gentle) pinta una vez", () => {
  // Emulación fiel de center-control-gentle/index.ts:745-801 en sus tres gestos:
  // cachear footer, borrarlo (bottom-fixed) y reinyectarlo si falta (dual / gentle-pi).
  registry().clear();
  const tui = freshTui(statusRail());
  const offWellness = mountSidebarSlot(tui, slotDef("ccg-w", 10, ["PomoReloj Bigote"]) as any);

  let cachedFooterRail: Rail | undefined = tui.parts.get("footer"); // :746
  const cycle = (mode: string) => {
    if (mode === "bottom-fixed") {
      if (tui.parts.has("footer")) {
        cachedFooterRail = tui.parts.get("footer"); // :765
        tui.parts.delete("footer"); // :766
      }
    } else if (cachedFooterRail && !tui.parts.has("footer")) {
      tui.parts.set("footer", cachedFooterRail); // :784 / :801
    }
  };

  cycle("bottom-fixed");
  // Mientras el compositor está retirado, otra extensión monta: no debe quedar huérfano duplicado.
  const offLens = mountSecondSlot(tui, slotDef("ccg-l", 20, ["Tools 3% | Chat 2%"]) as any);
  cycle("dual");
  cycle("gentle-pi");
  cycle("bottom-fixed");
  cycle("dual");

  const rail = tui.parts.get("footer") as Rail;
  assert.ok(rail, "El footer debe existir tras el ciclo de modos");
  const lines = rail.render(38);
  assert.equal(lineCount(lines, "PomoReloj Bigote"), 1, "Ranura de Wellness pintada una vez");
  assert.equal(lineCount(lines, "Tools 3% | Chat 2%"), 1, "Ranura de Lens pintada una vez");
  assert.equal(lineCount(lines, "Status"), 1, "La barra base no debe perderse ni duplicarse");

  offWellness?.();
  offLens?.();
  registry().clear();
});

test("Sidebar Dock · Reinyección de un compositor DISPOSADO no duplica ranuras", () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offWellness = mountSidebarSlot(tui, slotDef("zom", 10, ["Pomo"]) as any);

  const cached = tui.parts.get("footer") as Rail;
  tui.parts.delete("footer"); // gesto de bottom-fixed
  offWellness?.(); // su dueño lo desmonta mientras está fuera de parts

  const lensOff = mountSecondSlot(tui, slotDef("zom2", 20, ["Lens"]) as any);
  tui.parts.set("footer", cached); // reinyección de un rail ya sin dueño

  const rail = tui.parts.get("footer") as Rail;
  const lines = rail.render(38);
  assert.equal(compositorsInChain(rail), 1, "Un solo compositor por terminal");
  assert.equal(lineCount(lines, "Pomo"), 0, "La ranura desmontada no revive");
  assert.equal(lineCount(lines, "Lens"), 1, "La ranura viva se pinta una vez");

  lensOff?.();
  registry().clear();
});

test("Sidebar Dock · Desmontar conserva un footer ajeno y limpia las ranuras", () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const offA = mountSidebarSlot(tui, slotDef("dsp", 10, ["Pomo"]) as any);
  const outer = forwardingWrapper(tui.parts.get("footer") as Rail);
  tui.parts.set("footer", outer);
  const offB = mountSecondSlot(tui, slotDef("dsp2", 20, ["Lens"]) as any);

  const compositor = (tui.parts.get("footer") as Rail).__originalRail;
  offA?.();
  offB?.();
  registry().clear();
  compositor.dispose?.();

  assert.equal(tui.parts.get("footer"), outer, "No debe despojar el wrapper extranjero");
  assert.equal(lineCount((tui.parts.get("footer") as Rail).render(38), "Pomo"), 0);

  tui.parts.set("footer", (tui.parts.get("footer") as Rail).__originalRail);
  const plain = tui.parts.get("footer") as Rail;
  if (plain.__isWiloxSlotsCompositor) plain.dispose?.();
});

// --- R6 · diagnóstico de composición (solo lectura, contadores puros) ---

test("Sidebar Dock · Diagnóstico: ve el compositor bajo un wrapper extranjero", () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const off = mountSidebarSlot(tui, slotDef("diag", 10, ["Pomo"]) as any);
  const outer = forwardingWrapper(tui.parts.get("footer") as Rail);
  tui.parts.set("footer", outer);

  const chain = inspectSidebarChain(tui);
  assert.equal(chain.ok, true);
  assert.equal(chain.compositors, 1, "El conteo debe atravesar capas ajenas");
  assert.equal(chain.layers[0].marker, "cpamc-decorator");
  assert.equal(chain.layers[1].marker, "wilox-slots-compositor");
  assert.deepEqual(chain.slots, ["diag"]);

  off?.();
  registry().clear();
});

test("Sidebar Dock · Diagnóstico: distingue un frame con doble pintado", () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const off = mountSidebarSlot(tui, slotDef("cnt", 10, ["Pomo"]) as any);
  const compositor = tui.parts.get("footer") as Rail;

  compositor.digest();
  compositor.render(38);
  const afterSingle = inspectSidebarChain(tui).stats.doubleRenderFrames;

  compositor.render(38);
  const afterDouble = inspectSidebarChain(tui).stats.doubleRenderFrames;
  assert.equal(afterDouble - afterSingle, 1, "Segundo pintado sin digest = frame con doble pintado");

  compositor.digest();
  compositor.render(38);
  assert.equal(inspectSidebarChain(tui).stats.doubleRenderFrames, afterDouble,
    "Un frame limpio no debe sumar al contador");

  off?.();
  registry().clear();
});

test("Sidebar Dock · Diagnóstico: el dispose retira sus contadores del agregado", () => {
  registry().clear();
  const tui = freshTui(statusRail());
  const off = mountSidebarSlot(tui, slotDef("gc", 10, ["Pomo"]) as any);
  const compositor = tui.parts.get("footer") as Rail;
  const antes = inspectSidebarChain(tui).stats.compositors;

  off?.();
  registry().clear();
  compositor.dispose?.();
  assert.equal(inspectSidebarChain(tui).stats.compositors, antes - 1,
    "Un compositor desmontado no debe seguir contando");
});
