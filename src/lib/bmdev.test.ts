import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { bmdevWhatsappUrl } from "./bmdev";

afterEach(() => vi.unstubAllEnvs());

describe("bmdevWhatsappUrl", () => {
  it("reads BMDEV_WHATSAPP and pre-fills the brief's message", () => {
    vi.stubEnv("BMDEV_WHATSAPP", "+54 9 11 5555-0000");
    const url = new URL(bmdevWhatsappUrl({ businessName: "Dulce Ana" })!);
    expect(url.origin + url.pathname).toBe("https://wa.me/5491155550000");
    expect(url.searchParams.get("text")).toContain("Mi negocio se llama: Dulce Ana");
  });
  it("returns null when the number is missing or invalid", () => {
    vi.stubEnv("BMDEV_WHATSAPP", "");
    expect(bmdevWhatsappUrl()).toBeNull();
    vi.stubEnv("BMDEV_WHATSAPP", "123");
    expect(bmdevWhatsappUrl()).toBeNull();
  });
});
