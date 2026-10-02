/** WCAG helpers for merchant-picked colors. Pure, shared by server and UI. */

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** White or near-black, whichever reads better on the given background. */
export function readableOn(background: string): "#ffffff" | "#111111" {
  return contrastRatio("#ffffff", background) >= contrastRatio("#111111", background) ? "#ffffff" : "#111111";
}
