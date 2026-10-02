import { describe, expect, it } from "vitest";
import { suggestSlug, tempPassword } from "./rules";

describe("tempPassword", () => {
  it("has the requested length and only unambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      const p = tempPassword();
      expect(p).toHaveLength(14);
      expect(p).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
    }
  });
  it("discards biased bytes", () => {
    // 255 is above the rejection limit, so only the 0s are used.
    const bytes = () => new Uint8Array([255, 0, 255, 0, 255, 0, 255, 0]);
    expect(tempPassword(4, bytes)).toBe("AAAA");
  });
});

describe("suggestSlug", () => {
  it("builds a URL-safe slug", () => {
    expect(suggestSlug("Dulce Ana — Pastelería!")).toBe("dulce-ana-pasteleria");
    expect(suggestSlug("a".repeat(60))).toHaveLength(40);
  });
});
