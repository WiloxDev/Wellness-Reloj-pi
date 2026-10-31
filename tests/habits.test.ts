import { test } from "node:test";
import assert from "node:assert/strict";
import { WellnessTracker } from "../dist/core/habits.js";

test("WellnessTracker · Cálculo de intervalos de hábitos", () => {
  const tracker = new WellnessTracker(
    { waterMinutes: 40, eyeRestMinutes: 20, stretchMinutes: 60 },
    { lunch: "13:30", dinner: "21:00" }
  );

  const start = Date.now();
  // Estado inicial: 0 ms transcurridos
  const initial = tracker.getStatus(start);
  assert.equal(initial.water.remainingMins, 40);
  assert.equal(initial.water.isDue, false);
  assert.equal(initial.eyes.remainingMins, 20);
  assert.equal(initial.eyes.isDue, false);
  assert.equal(initial.stretch.remainingMins, 60);
  assert.equal(initial.stretch.isDue, false);

  // Transcurridos 25 minutos:
  // - Ojos (20m) debe estar vencido (isDue: true, remainingMins: 0)
  // - Agua (40m) debe tener 15m restantes
  // - Estirar (60m) debe tener 35m restantes
  const after25m = tracker.getStatus(start + 25 * 60 * 1000);
  assert.equal(after25m.eyes.isDue, true);
  assert.equal(after25m.eyes.remainingMins, 0);
  assert.equal(after25m.water.remainingMins, 15);
  assert.equal(after25m.water.isDue, false);
  assert.equal(after25m.stretch.remainingMins, 35);
});

test("WellnessTracker · Reinicio selectivo vs global", () => {
  const tracker = new WellnessTracker({ waterMinutes: 30, eyeRestMinutes: 20, stretchMinutes: 60 });
  const start = Date.now();

  // Avanzar 25 minutos
  const t1 = start + 25 * 60 * 1000;
  tracker.getStatus(t1);

  // Reiniciar solo 'eyes' en el momento t1
  tracker.resetTimer("eyes", t1);
  const afterResetEyes = tracker.getStatus(t1);
  assert.equal(afterResetEyes.eyes.remainingMins, 20);
  assert.equal(afterResetEyes.water.remainingMins, 5); // Agua sigue corriendo

  // Reiniciar todos en el momento t1
  tracker.resetAll(t1);
  const afterResetAll = tracker.getStatus(t1);
  assert.equal(afterResetAll.eyes.remainingMins, 20);
  assert.equal(afterResetAll.water.remainingMins, 30);
  assert.equal(afterResetAll.stretch.remainingMins, 60);
});

test("WellnessTracker · Agenda de Comidas y Descanso", () => {
  const tracker = new WellnessTracker({}, {
    breakfast: "08:30",
    lunch: "13:30",
    dinner: "21:00",
    rest: "23:00"
  });

  // A las 12:00, la siguiente comida es el Almuerzo (13:30) en 90m
  const dateAt12 = new Date(2026, 9, 30, 12, 0, 0);
  const status12 = tracker.getStatus(dateAt12.getTime());
  assert.ok(status12.nextMeal);
  assert.equal(status12.nextMeal?.name, "Almuerzo");
  assert.equal(status12.nextMeal?.time, "13:30");
  assert.equal(status12.nextMeal?.remainingMins, 90);

  // A las 23:30 (pasado el descanso de las 23:00), cicla al desayuno del día siguiente (08:30)
  const dateAt2330 = new Date(2026, 9, 30, 23, 30, 0);
  const status2330 = tracker.getStatus(dateAt2330.getTime());
  assert.ok(status2330.nextMeal);
  assert.equal(status2330.nextMeal?.name, "Desayuno");
  assert.equal(status2330.nextMeal?.remainingMins, 30 + 510); // 30m hasta medianoche + 8h30m
});
