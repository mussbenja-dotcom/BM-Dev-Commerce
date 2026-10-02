import { NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/services/catalog";
import { activeStoreId, jsonError } from "@/lib/store/api";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export async function GET(req: Request, ctx: RouteContext<"/api/store/[slug]/search">) {
  const { slug } = await ctx.params;
  if (!rateLimit(`search:${await clientIp()}`, 90, 60_000).ok) return jsonError("Demasiadas solicitudes.", 429);
  const storeId = await activeStoreId(slug);
  if (!storeId) return jsonError("Tienda no encontrada.", 404);
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = await getSearchSuggestions(storeId, q);
  return NextResponse.json(
    results.map((p) => ({ name: p.name, slug: p.slug, price: p.price, image: p.images[0]?.url ?? null })),
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
