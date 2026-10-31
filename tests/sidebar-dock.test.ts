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
