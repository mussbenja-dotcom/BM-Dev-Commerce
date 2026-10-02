import { Cormorant_Garamond, DM_Sans, Fraunces, Jost, Manrope } from "next/font/google";

// Only the fonts a page actually renders get downloaded by the browser.
export const jost = Jost({ subsets: ["latin"], variable: "--font-jost", preload: false, display: "swap" });
export const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", preload: false, display: "swap" });
export const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", preload: false, display: "swap" });
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  preload: false,
  display: "swap",
});

export const fontVariables = [jost, dmSans, manrope, fraunces, cormorant].map((f) => f.variable).join(" ");
