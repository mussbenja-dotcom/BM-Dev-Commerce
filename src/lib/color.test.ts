import { describe, expect, it } from "vitest";
import { contrastRatio, readableOn } from "./color";

describe("color", () => {
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });
  it("picks readable button text", () => {
    expect(readableOn("#1c1a17")).toBe("#ffffff");
    expect(readableOn("#f2d16b")).toBe("#111111");
  });
});
