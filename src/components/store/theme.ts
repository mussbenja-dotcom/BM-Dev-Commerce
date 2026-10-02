import type { CSSProperties } from "react";
import { RADIUS_PX, type ThemeTokens } from "@/lib/templates";

type ThemeRow = {
  primaryColor: string;
  primaryContrast: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  headingFont: string;
  bodyFont: string;
  radius: string;
  headingCase: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const safe = (v: string, fallback: string) => (HEX.test(v) ? v : fallback);
const FONT = /^[a-z-]+$/;

/** Turns a StoreTheme row into CSS custom properties consumed by globals.css. */
export function themeStyle(t: ThemeRow): CSSProperties {
  const upper = t.headingCase === "upper";
  return {
    "--c-bg": safe(t.backgroundColor, "#ffffff"),
    "--c-surface": safe(t.surfaceColor, "#f5f5f3"),
    "--c-fg": safe(t.textColor, "#15171a"),
    "--c-muted": safe(t.mutedColor, "#62666d"),
    "--c-line": safe(t.borderColor, "#e4e4df"),
    "--c-primary": safe(t.primaryColor, "#15171a"),
    "--c-on-primary": safe(t.primaryContrast, "#ffffff"),
    "--c-accent": safe(t.accentColor, "#e8551f"),
    "--f-heading": `var(--font-${FONT.test(t.headingFont) ? t.headingFont : "manrope"}), system-ui, sans-serif`,
    "--f-body": `var(--font-${FONT.test(t.bodyFont) ? t.bodyFont : "manrope"}), system-ui, sans-serif`,
    "--r": RADIUS_PX[t.radius as ThemeTokens["radius"]] ?? "10px",
    "--heading-case": upper ? "uppercase" : "none",
    "--heading-tracking": upper ? "0.06em" : "-0.015em",
  } as CSSProperties;
}
