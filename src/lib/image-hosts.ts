/**
 * Remote image hosts the storefront can render with next/image.
 * Shared by next.config.ts and the admin URL validation so a merchant can
 * never save an image the store would fail to display.
 */
import { UPLOAD_PATH } from "./image-type";

export const IMAGE_HOSTS = ["images.unsplash.com", "res.cloudinary.com"] as const;

export function isAllowedImageUrl(v: string): boolean {
  if (v.startsWith("/uploads/")) return UPLOAD_PATH.test(v);
  try {
    const u = new URL(v);
    return u.protocol === "https:" && (IMAGE_HOSTS as readonly string[]).includes(u.hostname);
  } catch {
    return false;
  }
}
