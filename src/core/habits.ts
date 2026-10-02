/**
 * Wellness and Ergonomics Habit Tracker
 */

export interface HabitIntervals {
  waterMinutes?: number;
  eyeRestMinutes?: number;
  stretchMinutes?: number;
}

export interface MealSchedule {
  breakfast?: string;      // "08:30"
  lunch?: string;          // "13:30"
  afternoonSnack?: string; // "17:00"
  dinner?: string;         // "21:00"
  rest?: string;           // "23:00"
}

export interface WellnessStatus {
  water: { remainingMins: number; percentage: number; isDue: boolean };
  eyes: { remainingMins: number; percentage: number; isDue: boolean };
  stretch: { remainingMins: number; percentage: number; isDue: boolean };
  nextMeal?: { name: string; time: string; remainingMins: number };
}

export class WellnessTracker {
  private lastWater: number;
  private lastEyeRest: number;
  private lastStretch: number;

  public waterIntervalMs: number;
  public eyeRestIntervalMs: number;
  public stretchIntervalMs: number;
  public schedule: MealSchedule;

  constructor(intervals: HabitIntervals = {}, schedule: MealSchedule = {}) {
    const now = Date.now();
    this.lastWater = now;
    this.lastEyeRest = now;
    this.lastStretch = now;

    this.waterIntervalMs = (intervals.waterMinutes ?? 45) * 60 * 1000;
    this.eyeRestIntervalMs = (intervals.eyeRestMinutes ?? 20) * 60 * 1000;
    this.stretchIntervalMs = (intervals.stretchMinutes ?? 60) * 60 * 1000;

    this.schedule = {
      breakfast: "08:30",
      lunch: "13:30",
      afternoonSnack: "17:00",
      dinner: "21:00",
      rest: "23:00",
      ...schedule
    };
  }

  public resetTimer(type: "water" | "eyes" | "stretch"): void {
    const now = Date.now();
    if (type === "water") this.lastWater = now;
    if (type === "eyes") this.lastEyeRest = now;
    if (type === "stretch") this.lastStretch = now;
  }

  public resetAll(): void {
    const now = Date.now();
    this.lastWater = now;
    this.lastEyeRest = now;
    this.lastStretch = now;
  }

  public getStatus(now = Date.now()): WellnessStatus {
    const calc = (last: number, interval: number) => {
      const elapsed = now - last;
      const remainingMs = Math.max(0, interval - elapsed);
      const remainingMins = Math.ceil(remainingMs / 60000);
      const percentage = Math.min(100, Math.floor((elapsed / interval) * 100));
      return {
        remainingMins,
        percentage,
        isDue: remainingMs <= 0
      };
    };

    return {
      water: calc(this.lastWater, this.waterIntervalMs),
      eyes: calc(this.lastEyeRest, this.eyeRestIntervalMs),
      stretch: calc(this.lastStretch, this.stretchIntervalMs),
      nextMeal: this.getNextScheduledEvent(new Date(now))
    };
  }

  private getNextScheduledEvent(nowDate: Date): { name: string; time: string; remainingMins: number } | undefined {
    const currentMins = nowDate.getHours() * 60 + nowDate.getMinutes();
    const meals: Array<{ name: string; time: string; mins: number }> = [];

    const parseTime = (timeStr?: string) => {
      if (!timeStr) return null;
      const parts = timeStr.split(":").map(Number);
      if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
      return parts[0] * 60 + parts[1];
    };

    if (this.schedule.breakfast) {
      const m = parseTime(this.schedule.breakfast);
      if (m !== null) meals.push({ name: "Desayuno", time: this.schedule.breakfast, mins: m });
    }
    if (this.schedule.lunch) {
      const m = parseTime(this.schedule.lunch);
      if (m !== null) meals.push({ name: "Almuerzo", time: this.schedule.lunch, mins: m });
    }
    if (this.schedule.afternoonSnack) {
      const m = parseTime(this.schedule.afternoonSnack);
      if (m !== null) meals.push({ name: "Merienda", time: this.schedule.afternoonSnack, mins: m });
    }
    if (this.schedule.dinner) {
      const m = parseTime(this.schedule.dinner);
      if (m !== null) meals.push({ name: "Cena", time: this.schedule.dinner, mins: m });
    }
    if (this.schedule.rest) {
      const m = parseTime(this.schedule.rest);
      if (m !== null) meals.push({ name: "Descanso", time: this.schedule.rest, mins: m });
    }

    meals.sort((a, b) => a.mins - b.mins);

    for (const meal of meals) {
      if (meal.mins > currentMins) {
        return {
          name: meal.name,
          time: meal.time,
          remainingMins: meal.mins - currentMins
        };
      }
    }

    // Next day's first meal
    if (meals.length > 0) {
      const first = meals[0];
      return {
        name: first.name,
        time: first.time,
        remainingMins: (1440 - currentMins) + first.mins
      };
    }

    return undefined;
  }
}
