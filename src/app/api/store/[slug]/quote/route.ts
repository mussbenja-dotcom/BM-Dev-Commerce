import { NextResponse } from "next/server";
import { buildQuote, quoteRequestSchema } from "@/lib/services/checkout";
import { activeStoreId, jsonError } from "@/lib/store/api";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export async function POST(req: Request, ctx: RouteContext<"/api/store/[slug]/quote">) {
  const { slug } = await ctx.params;
  if (!rateLimit(`quote:${await clientIp()}`, 120, 60_000).ok) return jsonError("Demasiadas solicitudes.", 429);
  const storeId = await activeStoreId(slug);
  if (!storeId) return jsonError("Tienda no encontrada.", 404);

  const body = await req.json().catch(() => null);
  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError("Solicitud inválida.");

  const quote = await buildQuote(storeId, parsed.data);
  return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } });
}
