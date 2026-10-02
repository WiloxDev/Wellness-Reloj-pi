import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
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

export function loadConfig(): WellnessConfig {
  const home = os.homedir();
  const candidatePaths = [
    path.join(process.cwd(), ".wellness.json"),
    path.join(home, ".wellnessrc.json"),
    path.join(home, ".config", "wellness", "config.json")
  ];

  for (const configPath of candidatePaths) {
    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw);
        return deepMerge(DEFAULT_CONFIG, parsed);
      }
    } catch {
      // Fallback silently if unreadable
    }
  }

  return DEFAULT_CONFIG;
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
