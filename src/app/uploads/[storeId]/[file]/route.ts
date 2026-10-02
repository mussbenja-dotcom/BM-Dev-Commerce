import { readLocalUpload } from "@/lib/services/uploads";

/** Serves locally stored uploads (only valid generated names; content type from the real bytes). */
export async function GET(_req: Request, { params }: { params: Promise<{ storeId: string; file: string }> }) {
  const { storeId, file } = await params;
  const found = await readLocalUpload(storeId, file);
  if (!found) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(found.bytes), {
    headers: {
      "Content-Type": found.type.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
