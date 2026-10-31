import { test } from "node:test";
import assert from "node:assert/strict";
import { ClockEngine, ROUNDED_DIGITS, SQUARE_DIGITS } from "../dist/core/clock.js";
import { visibleWidth } from "../dist/core/ansi.js";

test("ClockEngine · Formato 12h y períodos en español", () => {
  const clock = new ClockEngine({ format: "12h", locale: "es" });

  // 14:35 -> 02:35 p. m.
  const datePm = new Date(2026, 9, 30, 14, 35, 0);
  const timePm = clock.getTimeString(datePm);
  assert.equal(timePm.timeStr, "02:35");
  assert.equal(timePm.period, "p. m.");

  // 09:05 -> 09:05 a. m.
  const dateAm = new Date(2026, 9, 30, 9, 5, 0);
  const timeAm = clock.getTimeString(dateAm);
  assert.equal(timeAm.timeStr, "09:05");
  assert.equal(timeAm.period, "a. m.");

  // Medianoche: 00:00 -> 12:00 a. m.
  const midnight = new Date(2026, 9, 30, 0, 0, 0);
  assert.equal(clock.getTimeString(midnight).timeStr, "12:00");
  assert.equal(clock.getTimeString(midnight).period, "a. m.");

  // Mediodía: 12:00 -> 12:00 p. m.
  const noon = new Date(2026, 9, 30, 12, 0, 0);
  assert.equal(clock.getTimeString(noon).timeStr, "12:00");
  assert.equal(clock.getTimeString(noon).period, "p. m.");
});

test("ClockEngine · Formato 24h militar", () => {
  const clock = new ClockEngine({ format: "24h" });
  const date = new Date(2026, 9, 30, 21, 45, 0);
  const res = clock.getTimeString(date);
  assert.equal(res.timeStr, "21:45");
  assert.equal(res.period, "");
});

test("ClockEngine · Glifos ASCII (Rounded vs Square)", () => {
  const roundedClock = new ClockEngine({ asciiStyle: "rounded" });
  const squareClock = new ClockEngine({ asciiStyle: "square" });

  const [r0, r1, r2] = roundedClock.buildClockRows("08:30");
  const [s0, s1, s2] = squareClock.buildClockRows("08:30");

  // Invariante de altura: exactamente 3 filas
  assert.ok(r0 && r1 && r2);
  assert.ok(s0 && s1 && s2);

  // Invariante de ancho: todas las filas deben tener idéntico visibleWidth
  assert.equal(visibleWidth(r0), visibleWidth(r1));
  assert.equal(visibleWidth(r1), visibleWidth(r2));
  assert.equal(visibleWidth(s0), visibleWidth(s1));
  assert.equal(visibleWidth(s1), visibleWidth(s2));

  // Glifo 0 redondeado empieza con ╭─╮ y cuadrado con ┌─┐
  assert.ok(r0.includes("╭─╮"));
  assert.ok(s0.includes("┌─┐"));
});

test("ClockEngine · Fecha Calendario localizada", () => {
  const clockEs = new ClockEngine({ locale: "es" });
  const clockEn = new ClockEngine({ locale: "en" });

  const date = new Date(2026, 9, 30); // 30 Oct 2026 (Viernes)
  const strEs = clockEs.getDateString(date);
  const strEn = clockEn.getDateString(date);

  assert.match(strEs, /30 Oct 2026/);
  assert.match(strEn, /30 Oct 2026/);
  assert.ok(strEs.startsWith("Vie"));
  assert.ok(strEn.startsWith("Fri"));
});
