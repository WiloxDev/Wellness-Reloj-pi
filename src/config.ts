import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import { HabitIntervals, MealSchedule } from "./core/habits.js";
import { ClockOptions } from "./core/clock.js";

export interface WellnessConfig {
  schemaVersion?: string;
  enabled?: boolean;
  clock?: ClockOptions;
  habits?: HabitIntervals & { resetOnClick?: boolean };
  schedule?: MealSchedule;
  appearance?: {
    theme?: string;
    layout?: "side-by-side" | "stacked" | "auto";
    showSystemMetrics?: boolean;
  };
}

const DEFAULT_CONFIG: WellnessConfig = {
  schemaVersion: "1.0.0",
  enabled: true,
  clock: {
    format: "12h",
    showDate: true,
    locale: "es",
    asciiStyle: "rounded"
  },
  habits: {
    waterMinutes: 45,
    eyeRestMinutes: 20,
    stretchMinutes: 60,
    resetOnClick: true
  },
  schedule: {
    breakfast: "08:30",
    lunch: "13:30",
    afternoonSnack: "17:00",
    dinner: "21:00",
    rest: "23:00"
  },
  appearance: {
    theme: "gentle-default",
    layout: "auto",
    showSystemMetrics: false
  }
};

export function getWiloxUnifiedConfigPath(): string {
  return path.join(os.homedir(), ".config", "wiloxdev", "settings.json");
}

export function getLegacyWellnessConfigPath(): string {
  return path.join(os.homedir(), ".wellnessrc.json");
}

export function loadConfig(): WellnessConfig {
  const home = os.homedir();
  const unifiedPath = getWiloxUnifiedConfigPath();

  let merged = { ...DEFAULT_CONFIG };

  // 1. Check legacy and local configs first
  const candidatePaths = [
    path.join(process.cwd(), ".wellness.json"),
    getLegacyWellnessConfigPath(),
    path.join(home, ".config", "wellness", "config.json")
  ];

  for (const configPath of candidatePaths) {
    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw);
        merged = deepMerge(merged, parsed);
        break;
      }
    } catch {
      // Fallback silently if unreadable
    }
  }

  // 2. Highest authority: Unified WiloxDev config (~/.config/wiloxdev/settings.json)
  try {
    if (fs.existsSync(unifiedPath)) {
      const raw = fs.readFileSync(unifiedPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.wellness === "object") {
        merged = deepMerge(merged, parsed.wellness);
      }
    }
  } catch {
    // Fallback silently if unreadable
  }

  return merged;
}

export function persistWellnessPatch(patch: Partial<WellnessConfig>): WellnessConfig {
  const unifiedPath = getWiloxUnifiedConfigPath();
  const unifiedDir = path.dirname(unifiedPath);
  const legacyPath = getLegacyWellnessConfigPath();

  // 1. Atomic POSIX write to ~/.config/wiloxdev/settings.json
  try {
    fs.mkdirSync(unifiedDir, { recursive: true });
    let fullUnified: any = {};
    if (fs.existsSync(unifiedPath)) {
      try {
        fullUnified = JSON.parse(fs.readFileSync(unifiedPath, "utf-8")) || {};
      } catch {
        fullUnified = {};
      }
    }

    fullUnified.schema = fullUnified.schema || "wiloxdev.unified/v1";
    fullUnified.wellness = deepMerge(fullUnified.wellness || {}, patch);

    const tempUnified = `${unifiedPath}.${randomUUID()}.tmp`;
    fs.writeFileSync(tempUnified, JSON.stringify(fullUnified, null, 2) + "\n", { mode: 0o600 });
    fs.renameSync(tempUnified, unifiedPath);
  } catch (err) {
    console.warn("[wellness-reloj] Error persistiendo en ~/.config/wiloxdev/settings.json:", err);
  }

  // 2. Atomic mirror to ~/.wellnessrc.json for backwards compatibility
  try {
    let currentLegacy: any = {};
    if (fs.existsSync(legacyPath)) {
      try {
        currentLegacy = JSON.parse(fs.readFileSync(legacyPath, "utf-8")) || {};
      } catch {
        currentLegacy = {};
      }
    }
    const mergedLegacy = deepMerge(currentLegacy, patch);
    const tempLegacy = `${legacyPath}.${randomUUID()}.tmp`;
    fs.writeFileSync(tempLegacy, JSON.stringify(mergedLegacy, null, 2) + "\n", { mode: 0o600 });
    fs.renameSync(tempLegacy, legacyPath);
  } catch {
    // Silent fallback
  }

  return loadConfig();
}

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    for (const key of Object.keys(source)) {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    }
  }
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === "object" && !Array.isArray(item);
}
