import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClosedCard, renderWellnessCard } from "../dist/ui/card.js";
import { ClockEngine } from "../dist/core/clock.js";
import { WellnessTracker } from "../dist/core/habits.js";
import { visibleWidth } from "../dist/core/ansi.js";

test("buildClosedCard · Generación de caja cerrada y ancho invariante", () => {
  const content = [
    "Línea 1 corta",
    "Línea 2 con longitud media",
    "Línea 3 extraordinariamente larga que excede la tarjeta"
  ];

  const targetWidth = 36;
  const card = buildClosedCard("⏱️ Card Title", content, targetWidth);

  assert.ok(card.length >= 5, "Debe tener borde superior, contenido y borde inferior");
  assert.ok(card[0].includes("╭"), "Borde superior debe iniciar con ╭");
  assert.ok(card[0].includes("╮"), "Borde superior debe terminar con ╮");
  assert.ok(card[card.length - 1].includes("╰"), "Borde inferior debe iniciar con ╰");
  assert.ok(card[card.length - 1].includes("╯"), "Borde inferior debe terminar con ╯");

  // Invariante de ancho visible de cada fila
  for (const row of card) {
    assert.equal(visibleWidth(row), targetWidth, `Fila '${row}' debe tener ancho exacto de ${targetWidth}`);
  }
});

test("renderWellnessCard · Disposición Side-by-side vs Stacked", () => {
  const clockEngine = new ClockEngine({ format: "12h", asciiStyle: "rounded" });
  const tracker = new WellnessTracker({ waterMinutes: 45 });

  // 1. Ancho suficiente (>= 34 cols) en modo auto genera side-by-side
  const wideRows = renderWellnessCard({
    width: 38,
    clockEngine,
    tracker,
    config: { enabled: true, appearance: { layout: "auto" } }
  });
  assert.ok(wideRows.length > 0);
  for (const r of wideRows) {
    assert.equal(visibleWidth(r), 38);
  }

  // 2. Ancho estrecho (28 cols) genera modo stacked
  const narrowRows = renderWellnessCard({
    width: 28,
    clockEngine,
    tracker,
    config: { enabled: true, appearance: { layout: "auto" } }
  });
  assert.ok(narrowRows.length > 0);
  for (const r of narrowRows) {
    assert.equal(visibleWidth(r), 28);
  }

  // 3. Cuando enabled: false, debe retornar []
  const disabledRows = renderWellnessCard({
    width: 38,
    clockEngine,
    tracker,
    config: { enabled: false }
  });
  assert.deepEqual(disabledRows, []);
});

test("renderWellnessCard · Alerta crítica ¡AHORA! al vencer", () => {
  const clockEngine = new ClockEngine();
  const tracker = new WellnessTracker({ waterMinutes: 10 });
  const future = new Date(Date.now() + 15 * 60 * 1000); // 15m transcurridos (vencido)

  const rows = renderWellnessCard({
    width: 38,
    clockEngine,
    tracker,
    config: { enabled: true },
    now: future
  });

  const fullText = rows.join("\n");
  assert.ok(fullText.includes("¡AHORA!"), "Debe mostrar alerta de ¡AHORA! cuando el agua esté vencida");
});
