/**
 * Digital ASCII Clock Engine (3x3 Rounded Box-Drawing glyphs)
 */

export const ROUNDED_DIGITS: Record<string, string[]> = {
  "0": ["╭─╮", "│ │", "╰─╯"],
  "1": [" ╷ ", " │ ", " ╵ "],
  "2": ["╶─╮", "╭─╯", "╰─╴"],
  "3": ["╶─╮", " ─┤", "╶─╯"],
  "4": ["╷ ╷", "╰─┤", "  ╵"],
  "5": ["╭─╴", "╰─╮", "╶─╯"],
  "6": ["╭─╴", "├─╮", "╰─╯"],
  "7": ["╶─╮", "  │", "  ╵"],
  "8": ["╭─╮", "├─┤", "╰─╯"],
  "9": ["╭─╮", "╰─┤", "╶─╯"],
  ":": ["   ", " · ", " · "],
  " ": ["   ", "   ", "   "]
};

export const SQUARE_DIGITS: Record<string, string[]> = {
  "0": ["┌─┐", "│ │", "└─┘"],
  "1": [" ┐ ", " │ ", " ┴ "],
  "2": ["╶─┐", "┌─┘", "└─╴"],
  "3": ["╶─┐", " ─┤", "╶─┘"],
  "4": ["│ │", "└─┤", "  │"],
  "5": ["┌─╴", "└─┐", "╶─┘"],
  "6": ["┌─╴", "├─┐", "└─┘"],
  "7": ["╶─┐", "  │", "  │"],
  "8": ["┌─┐", "├─┤", "└─┘"],
  "9": ["┌─┐", "└─┤", "╶─┘"],
  ":": ["   ", " · ", " · "],
  " ": ["   ", "   ", "   "]
};

export interface ClockOptions {
  format?: "12h" | "24h";
  locale?: "es" | "en";
  asciiStyle?: "rounded" | "square";
  showDate?: boolean;
}

export class ClockEngine {
  private format: "12h" | "24h";
  private locale: "es" | "en";
  private asciiStyle: "rounded" | "square";

  constructor(options: ClockOptions = {}) {
    this.format = options.format || "12h";
    this.locale = options.locale || "es";
    this.asciiStyle = options.asciiStyle || "rounded";
  }

  public getTimeString(now = new Date()): { timeStr: string; period: string } {
    let hours = now.getHours();
    const minutes = now.getMinutes();
    let period = "";

    if (this.format === "12h") {
      if (this.locale === "es") {
        period = hours >= 12 ? "p. m." : "a. m.";
      } else {
        period = hours >= 12 ? "PM" : "AM";
      }
      hours = hours % 12;
      if (hours === 0) hours = 12;
    }

    const hStr = hours < 10 ? `0${hours}` : `${hours}`;
    const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return {
      timeStr: `${hStr}:${mStr}`,
      period
    };
  }

  public getDateString(now = new Date()): string {
    const daysEs = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const monthsEs = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ];

    const daysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthsEn = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const dayName = (this.locale === "es" ? daysEs : daysEn)[now.getDay()];
    const monthName = (this.locale === "es" ? monthsEs : monthsEn)[now.getMonth()];
    const dayNum = now.getDate();
    const year = now.getFullYear();

    return `${dayName}, ${dayNum} ${monthName} ${year}`;
  }

  public buildClockRows(timeStr: string): [string, string, string] {
    const glyphs = this.asciiStyle === "square" ? SQUARE_DIGITS : ROUNDED_DIGITS;
    const r0: string[] = [];
    const r1: string[] = [];
    const r2: string[] = [];

    for (const ch of timeStr) {
      const g = glyphs[ch] || glyphs[" "];
      r0.push(g[0]);
      r1.push(g[1]);
      r2.push(g[2]);
    }

    return [r0.join(""), r1.join(""), r2.join("")];
  }
}
