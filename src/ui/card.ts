import { visibleWidth, truncateToWidth } from "../core/ansi.js";
import { ClockEngine } from "../core/clock.js";
import { WellnessTracker } from "../core/habits.js";
import { WellnessConfig } from "../config.js";

export interface CardRenderOptions {
  width: number;
  clockEngine: ClockEngine;
  tracker: WellnessTracker;
  config: WellnessConfig;
  theme?: any;
}

/**
 * Builds a clean closed card with rounded borders matching Gentle-Pi aesthetics
 */
export function buildClosedCard(
  title: string,
  contentLines: string[],
  cardWidth: number,
  theme?: any
): string[] {
  const safeWidth = Math.max(cardWidth, 24);
  const innerWidth = safeWidth - 2; // Left border '│' and right border '│'

  // ANSI styling fallbacks
  const cBorder = (s: string) => theme?.border ? theme.border(s) : `\x1b[90m${s}\x1b[0m`;
  const cTitle = (s: string) => theme?.accent ? theme.accent(s) : `\x1b[1;36m${s}\x1b[0m`;

  const topTitle = title ? ` ${title} ` : "";
  const topBorderLen = Math.max(0, innerWidth - visibleWidth(topTitle));
  const topBar = cBorder("╭") + cTitle(topTitle) + cBorder("─".repeat(topBorderLen) + "╮");

  const rows: string[] = [topBar];

  for (const line of contentLines) {
    const vLen = visibleWidth(line);
    let paddedLine = line;
    if (vLen < innerWidth) {
      paddedLine = line + " ".repeat(innerWidth - vLen);
    } else if (vLen > innerWidth) {
      paddedLine = truncateToWidth(line, innerWidth);
    }
    rows.push(cBorder("│") + paddedLine + cBorder("│"));
  }

  const bottomBar = cBorder("╰" + "─".repeat(innerWidth) + "╯");
  rows.push(bottomBar);

  return rows;
}

/**
 * Main renderer for the right sidebar card
 */
export function renderWellnessCard(options: CardRenderOptions): string[] {
  const { width, clockEngine, tracker, config, theme } = options;
  const now = new Date();
  const { timeStr, period } = clockEngine.getTimeString(now);
  const dateStr = clockEngine.getDateString(now);
  const status = tracker.getStatus(now.getTime());

  const cText = (s: string) => theme?.text ? theme.text(s) : s;
  const cMuted = (s: string) => theme?.muted ? theme.muted(s) : `\x1b[90m${s}\x1b[0m`;
  const cWarn = (s: string) => `\x1b[33m${s}\x1b[0m`;
  const cAlert = (s: string) => `\x1b[31;1m${s}\x1b[0m`;
  const cOk = (s: string) => `\x1b[32m${s}\x1b[0m`;

  const [cRow0, cRow1, cRow2] = clockEngine.buildClockRows(timeStr);

  const formatTimer = (item: { remainingMins: number; isDue: boolean }, icon: string, label: string) => {
    if (item.isDue) return `${icon} ${cAlert(`${label}: ¡AHORA!`)}`;
    const color = item.remainingMins <= 5 ? cWarn : cOk;
    return `${icon} ${label}: ${color(`${item.remainingMins}m`)}`;
  };

  const waterLine = formatTimer(status.water, "💧", "Agua");
  const eyeLine = formatTimer(status.eyes, "👁 ", "Ojos");
  const stretchLine = formatTimer(status.stretch, "🧘", "Pausa");

  const content: string[] = [];
  const innerWidth = width - 2;

  // Decide layout: Side-by-side if width >= 34 cols, else stacked
  const isSideBySide = (config.appearance?.layout === "side-by-side") ||
    (config.appearance?.layout === "auto" && innerWidth >= 32);

  if (isSideBySide) {
    const clockWidth = visibleWidth(cRow0);
    const gap = 2;
    const rightColWidth = Math.max(0, innerWidth - clockWidth - gap);

    const l0 = truncateToWidth(waterLine, rightColWidth);
    const l1 = truncateToWidth(eyeLine, rightColWidth);
    const l2 = truncateToWidth(stretchLine, rightColWidth);

    content.push(`${cText(cRow0)}${" ".repeat(gap)}${l0}`);
    content.push(`${cText(cRow1)}${" ".repeat(gap)}${l1}`);
    content.push(`${cText(cRow2)}${" ".repeat(gap)}${l2}`);
  } else {
    content.push(cText(cRow0));
    content.push(cText(cRow1));
    content.push(cText(cRow2));
    content.push("");
    content.push(waterLine);
    content.push(eyeLine);
    content.push(stretchLine);
  }

  // Next meal / scheduled event footer line
  if (status.nextMeal) {
    const mealText = `🍴 ${status.nextMeal.name} (${status.nextMeal.time}) en ${status.nextMeal.remainingMins}m`;
    content.push(cMuted(mealText));
  }

  // Date and period subtitle
  const footerDate = config.clock?.showDate !== false ? `${dateStr}  ${period}` : period;
  if (footerDate) {
    content.push(cMuted(footerDate));
  }

  return buildClosedCard("⏰ Wellness & Reloj", content, width, theme);
}
