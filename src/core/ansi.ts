/**
 * Zero-dependency ANSI and Unicode visible width calculator.
 * Strips ANSI escape sequences and handles full-width characters safely.
 */

// Regex for matching ANSI escape codes (colors, cursor movements, etc.)
const ANSI_REGEX = new RegExp(
  "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
  "g"
);

export function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}

export function visibleWidth(str: string): number {
  if (!str) return 0;
  const clean = stripAnsi(str);
  let width = 0;
  const chars = Array.from(clean);
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const code = char.codePointAt(0) || 0;
    const nextChar = chars[i + 1];
    const nextCode = nextChar ? nextChar.codePointAt(0) : 0;

    if (code >= 0xfe00 && code <= 0xfe0f) {
      continue;
    }

    if (nextCode === 0xfe0f) {
      width += 2;
      i++;
      continue;
    }

    // Wide / Fullwidth / Emoji ranges aligned with @earendil-works/pi-tui
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x231a && code <= 0x231b) || // ⌚, ⌛
      (code >= 0x23e9 && code <= 0x23f3) || // ⏩-⏳ (incluye ⏰ 0x23F0)
      (code >= 0x23f8 && code <= 0x23fa) || // ⏸-⏺
      (code >= 0x2600 && code <= 0x27bf) || // Símbolos misceláneos y Dingbats
      (code >= 0x2b50 && code <= 0x2b55) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      code > 0xffff
    ) {
      // Símbolos con presentación de texto estándar
      if (code === 0x1f441 && nextCode !== 0xfe0f) {
        width += 1;
      } else if (code === 0x2699 || code === 0x2794 || code === 0x2714) {
        width += 1;
      } else {
        width += 2;
      }
    } else {
      width += 1;
    }
  }
  return width;
}

export function fitToWidth(str: string, targetWidth: number): string {
  const current = visibleWidth(str);
  if (current === targetWidth) return str;
  if (current > targetWidth) return truncateToWidth(str, targetWidth);
  return str + " ".repeat(targetWidth - current);
}

export function truncateToWidth(str: string, maxWidth: number, ellipsis = "…"): string {
  if (visibleWidth(str) <= maxWidth) return str;
  const ellWidth = visibleWidth(ellipsis);
  let curWidth = 0;
  let result = "";
  for (const char of str) {
    const w = visibleWidth(char);
    if (curWidth + w + ellWidth > maxWidth) break;
    result += char;
    curWidth += w;
  }
  return result + ellipsis;
}
