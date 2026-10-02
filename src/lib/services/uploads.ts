import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { detectImageType, MAX_UPLOAD_BYTES, type ImageType } from "@/lib/image-type";

export class UploadError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Local uploads live outside public/: Next only serves public files that existed at startup. */
export function uploadDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "uploads"));
}

function cloudinaryConfig() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME, key = process.env.CLOUDINARY_API_KEY, secret = process.env.CLOUDINARY_API_SECRET;
  return cloud && key && secret ? { cloud, key, secret } : null;
}

async function toCloudinary(cfg: { cloud: string; key: string; secret: string }, storeId: string, bytes: Uint8Array, type: ImageType) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = `bmdev/${storeId}`;
  // Signed upload: sha1 of the sorted params + API secret.
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${cfg.secret}`).digest("hex");
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(bytes)], { type: type.mime }));
  form.set("api_key", cfg.key);
  form.set("timestamp", timestamp);
  form.set("folder", folder);
  form.set("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloud)}/image/upload`, { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as { secure_url?: string } | null;
  if (!res.ok || !data?.secure_url?.startsWith("https://res.cloudinary.com/")) throw new UploadError("No pudimos subir la imagen. Probá de nuevo en unos minutos.", 502);
  return data.secure_url;
}

/** Validates the real bytes and stores the image for one store. Returns the URL to save. */
export async function storeImage(storeId: string, bytes: Uint8Array): Promise<string> {
  if (!/^[a-z0-9]{8,40}$/.test(storeId)) throw new UploadError("Tienda inválida.", 400);
  if (bytes.byteLength === 0) throw new UploadError("El archivo está vacío.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("La imagen supera los 4 MB. Achicala y probá de nuevo.", 413);
  const type = detectImageType(bytes);
  if (!type) throw new UploadError("Solo se pueden subir fotos JPG, PNG o WebP.", 415);
  const cfg = cloudinaryConfig();
  if (cfg) return toCloudinary(cfg, storeId, bytes, type);
  const name = `${randomBytes(18).toString("base64url")}.${type.ext}`;
  const dir = path.join(/*turbopackIgnore: true*/ uploadDir(), storeId);
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, name), bytes, { flag: "wx" });
  return `/uploads/${storeId}/${name}`;
}

export async function readLocalUpload(storeId: string, file: string): Promise<{ bytes: Buffer; type: ImageType } | null> {
  if (!/^[a-z0-9]{8,40}$/.test(storeId) || !/^[A-Za-z0-9_-]{16,64}\.(jpg|png|webp)$/.test(file)) return null;
  const full = path.join(/*turbopackIgnore: true*/ uploadDir(), storeId, file);
  if (!full.startsWith(uploadDir() + path.sep)) return null;
  try {
    const bytes = await readFile(/*turbopackIgnore: true*/ full);
    const type = detectImageType(bytes);
    return type ? { bytes, type } : null;
  } catch {
    return null;
  }
}
