import { test } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import {
  COMMUNITY_REGISTRY_SLOT,
  registerWellnessCommunityModule
} from "../dist/wilox-community.js";
import {
  loadConfig,
  persistWellnessPatch,
  getWiloxUnifiedConfigPath
} from "../dist/config.js";

test("WiloxDev Community Module · Registration and Progressive Disclosure", () => {
  let mockConfig: any = {
    enabled: true,
    clock: { format: "12h", asciiStyle: "rounded", showDate: true },
    habits: { waterMinutes: 45, eyeRestMinutes: 20, stretchMinutes: 60 }
  };

  let rendered = false;
  registerWellnessCommunityModule(
    () => mockConfig,
    {
      onConfigChanged: (newCfg: any) => { mockConfig = newCfg; },
      requestRender: () => { rendered = true; }
    }
  );

  const registry = (globalThis as any)[COMMUNITY_REGISTRY_SLOT];
  assert.ok(registry, "Global bus must have a registered map");
  assert.ok(registry.has("wellness-reloj"), "Registry must contain wellness-reloj module");

  const moduleDef = registry.get("wellness-reloj")!;
  assert.strictEqual(moduleDef.id, "wellness-reloj");
  assert.strictEqual(moduleDef.title, "🍅 PomoReloj Bigote");
  assert.strictEqual(moduleDef.order, 35);

  // When enabled === true, progressive disclosure returns all rows
  const activeRows = moduleDef.rows;
  assert.strictEqual(activeRows.length, 10, "Should return 10 rows when enabled");
  assert.strictEqual(activeRows[0].label(), "PomoReloj: [ON]");

  // Visual Badges standard: No redundant keyboard hints
  for (const row of activeRows) {
    const lbl = row.label();
    assert.doesNotMatch(lbl, /Enter to/i, `Label '${lbl}' must not contain redundant keyboard hint`);
    assert.doesNotMatch(lbl, /Press/i, `Label '${lbl}' must not contain redundant keyboard hint`);
    assert.match(lbl, /\[.*?\]/, `Label '${lbl}' must contain a bracketed state [value]`);
    const preview = row.preview();
    assert.ok(preview.title && preview.sample, "Row preview must have title and sample");
  }

  // When enabled === false, progressive disclosure returns ONLY master row
  mockConfig = { ...mockConfig, enabled: false };
  const disabledRows = moduleDef.rows;
  assert.strictEqual(disabledRows.length, 1, "Should return only 1 master row when disabled");
  assert.strictEqual(disabledRows[0].label(), "PomoReloj: [OFF]");
  assert.strictEqual(moduleDef.summary(), "Disabled");
});

test("WiloxDev Community Module · Row Actions & Hot Reactivity", () => {
  let currentConfig: any = {
    enabled: true,
    clock: { format: "12h", asciiStyle: "rounded", showDate: true },
    habits: { waterMinutes: 45, eyeRestMinutes: 20, stretchMinutes: 60 },
    appearance: { layout: "auto" }
  };

  let renderCount = 0;
  let resetTriggered = false;

  registerWellnessCommunityModule(
    () => currentConfig,
    {
      onConfigChanged: (cfg) => {
        currentConfig = cfg;
      },
      onRequestRender: () => {
        renderCount++;
      },
      onResetHabits: () => {
        resetTriggered = true;
      }
    }
  );

  const registry = (globalThis as any)[COMMUNITY_REGISTRY_SLOT];
  const moduleDef = registry.get("wellness-reloj")!;
  const rows = moduleDef.rows;

  // Find Reset row
  const resetRow = rows.find((r: any) => r.id === "wellness-reset-timers");
  assert.ok(resetRow, "Reset row must exist");
  resetRow.action();
  assert.ok(resetTriggered, "Reset habits callback must be executed");
});

test("Atomic POSIX Persistence · settings.json", () => {
  const unifiedPath = getWiloxUnifiedConfigPath();
  const initialConfig = loadConfig();
  assert.ok(initialConfig, "Should load valid configuration");

  // Persist patch
  const updated = persistWellnessPatch({
    clock: { format: "24h" }
  });
  assert.strictEqual(updated.clock?.format, "24h");

  // Read raw file to verify atomic JSON write
  assert.ok(fs.existsSync(unifiedPath), "Unified settings file must exist");
  const raw = JSON.parse(fs.readFileSync(unifiedPath, "utf8"));
  assert.strictEqual(raw.wellness?.clock?.format, "24h");

  // Revert for cleanliness
  persistWellnessPatch({
    clock: { format: "12h" }
  });
});
