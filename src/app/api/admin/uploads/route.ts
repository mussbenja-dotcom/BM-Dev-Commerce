import { getSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";
import { MAX_UPLOAD_BYTES } from "@/lib/image-type";
import { storeImage, UploadError } from "@/lib/services/uploads";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Image upload for the merchant panel. The store always comes from the session. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Origen no permitido." }, 403);
  const session = await getSession();
  if (!session?.storeId) return json({ error: "Tu sesión expiró. Volvé a ingresar." }, 401);
  if (session.isDemo) return json({ error: "En modo demo no se pueden subir archivos." }, 403);
  if (!rateLimit(`upload:${session.userId}`, 30, 10 * 60_000).ok) return json({ error: "Subiste muchas imágenes seguidas. Esperá unos minutos." }, 429);
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return json({ error: "La imagen supera los 4 MB. Achicala y probá de nuevo." }, 413);
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return json({ error: "No recibimos ninguna imagen." }, 400);
  }
  if (!(file instanceof File)) return json({ error: "No recibimos ninguna imagen." }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: "La imagen supera los 4 MB. Achicala y probá de nuevo." }, 413);
  try {
    const url = await storeImage(session.storeId, new Uint8Array(await file.arrayBuffer()));
    await audit({ action: "upload.image", storeId: session.storeId, userId: session.userId, meta: { url, size: file.size } });
    return json({ url });
  } catch (err) {
    if (err instanceof UploadError) return json({ error: err.message }, err.status);
    console.error("[upload] failed", err);
    return json({ error: "No pudimos subir la imagen." }, 500);
  }
}
