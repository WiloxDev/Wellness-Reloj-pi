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
  const clean = stripAnsi(str);
  let width = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    // Rough check for wide characters (CJK, emojis, symbols)
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      clean.codePointAt(i)! > 0xffff
    ) {
      width += 2;
      if (clean.codePointAt(i)! > 0xffff) i++;
    } else {
      width += 1;
    }
  }
  return width;
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
