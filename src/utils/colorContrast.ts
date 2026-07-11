function expandShorthandHex(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = expandShorthandHex(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return { r, g, b };
}

function toLinearChannel(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  const [lr, lg, lb] = [r, g, b].map(toLinearChannel);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/**
 * WCAG 2.x の相対輝度に基づくコントラスト比を返す（1:1 〜 21:1）。
 * https://www.w3.org/TR/WCAG21/#contrast-minimum
 */
export function getContrastRatio(colorA: string, colorB: string): number {
  const l1 = relativeLuminance(colorA);
  const l2 = relativeLuminance(colorB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
