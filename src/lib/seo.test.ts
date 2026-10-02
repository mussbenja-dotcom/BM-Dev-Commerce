import { describe, expect, it } from "vitest";
import { jsonLdString, storeMetadata } from "./seo";

describe("seo", () => {
  it("never lets JSON-LD close the script tag", () => {
    const out = jsonLdString({ name: "</script><script>alert(1)</script> & co" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script> & co");
  });
  it("builds canonical, OG and noindex for demos", () => {
    const store = { name: "Alma", isDemo: true, settings: { seoTitle: null, seoDescription: null, description: "Ropa".repeat(60), tagline: null, logoUrl: null } };
    const m = storeMetadata(store, "https://alma.com.ar", { path: "/productos/remera", title: "Remera", image: "https://images.unsplash.com/x" });
    expect(m.alternates?.canonical).toBe("https://alma.com.ar/productos/remera");
    expect(m.title).toEqual({ absolute: "Remera | Alma" });
    expect((m.description as string).length).toBeLessThanOrEqual(160);
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(storeMetadata({ ...store, isDemo: false }, "https://alma.com.ar", { path: "" }).robots).toBeUndefined();
  });
});
