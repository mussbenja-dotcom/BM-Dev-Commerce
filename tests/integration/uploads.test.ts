import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
vi.mock("server-only", () => ({}));

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
let dir: string;
let mod: typeof import("@/lib/services/uploads");

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "bm-uploads-"));
  process.env.UPLOAD_DIR = dir;
  delete process.env.CLOUDINARY_CLOUD_NAME;
  mod = await import("@/lib/services/uploads");
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("uploads", () => {
  it("stores a real image under the store folder and serves it back", async () => {
    const url = await mod.storeImage("cmgstore0001", new Uint8Array(PNG));
    expect(url).toMatch(/^\/uploads\/cmgstore0001\/[A-Za-z0-9_-]+\.png$/);
    const [, , storeId, file] = url.split("/");
    const read = await mod.readLocalUpload(storeId, file);
    expect(read?.type.mime).toBe("image/png");
    expect(Buffer.compare(read!.bytes, PNG)).toBe(0);
  });

  it("rejects non-images, oversize files and bad store ids", async () => {
    await expect(mod.storeImage("cmgstore0001", new TextEncoder().encode("<svg onload=alert(1)></svg>"))).rejects.toMatchObject({ status: 415 });
    await expect(mod.storeImage("cmgstore0001", new Uint8Array(4 * 1024 * 1024 + 1))).rejects.toMatchObject({ status: 413 });
    await expect(mod.storeImage("../etc", new Uint8Array(PNG))).rejects.toMatchObject({ status: 400 });
  });

  it("never reads outside the uploads folder", async () => {
    expect(await mod.readLocalUpload("..", "passwd.png")).toBeNull();
    expect(await mod.readLocalUpload("cmgstore0001", "../../.env")).toBeNull();
    expect(await mod.readLocalUpload("cmgstore0001", "AAAAAAAAAAAAAAAAAAAA.png")).toBeNull();
  });
});
