/** Detects an image type from its first bytes. The client's MIME type and file name are never trusted. */
export type ImageType = { ext: "jpg" | "png" | "webp"; mime: "image/jpeg" | "image/png" | "image/webp" };

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function detectImageType(bytes: Uint8Array): ImageType | null {
  const at = (i: number, ...sig: number[]) => sig.every((b, j) => bytes[i + j] === b);
  if (bytes.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return { ext: "jpg", mime: "image/jpeg" };
  if (bytes.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { ext: "png", mime: "image/png" };
  if (bytes.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return { ext: "webp", mime: "image/webp" };
  return null;
}

/** /uploads/<storeId>/<random>.<ext> — the only local upload paths the app serves. */
export const UPLOAD_PATH = /^\/uploads\/([a-z0-9]{8,40})\/([A-Za-z0-9_-]{16,64})\.(jpg|png|webp)$/;
