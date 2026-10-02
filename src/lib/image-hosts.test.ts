import { describe, expect, it } from "vitest";
import { isAllowedImageUrl } from "./image-hosts";

describe("isAllowedImageUrl", () => {
  it("accepts configured hosts and local uploads", () => {
    expect(isAllowedImageUrl("https://images.unsplash.com/photo-1?w=800")).toBe(true);
    expect(isAllowedImageUrl("https://res.cloudinary.com/demo/image/upload/a.jpg")).toBe(true);
    expect(isAllowedImageUrl("/uploads/store/a.jpg")).toBe(true);
  });
  it("rejects hosts the storefront cannot render, http and path tricks", () => {
    expect(isAllowedImageUrl("https://example.com/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("http://images.unsplash.com/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://images.unsplash.com.evil.com/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("/uploads/../.env")).toBe(false);
  });
});
