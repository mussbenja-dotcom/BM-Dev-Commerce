import { describe, expect, it } from "vitest";
import { detectImageType, UPLOAD_PATH } from "./image-type";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("detectImageType", () => {
  it("recognizes jpeg, png and webp by signature", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))?.ext).toBe("webp");
  });
  it("rejects svg, html, gif and empty files whatever their name says", () => {
    expect(detectImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a........"))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("UPLOAD_PATH", () => {
  it("only matches generated upload paths", () => {
    expect(UPLOAD_PATH.test("/uploads/cmg1abcd1234/Ab3_x-9ZkQ1mN0pQrS.webp")).toBe(true);
    expect(UPLOAD_PATH.test("/uploads/../.env")).toBe(false);
    expect(UPLOAD_PATH.test("/uploads/cmg1abcd1234/a.svg")).toBe(false);
    expect(UPLOAD_PATH.test("/uploads/cmg1abcd1234/short.png")).toBe(false);
  });
});
