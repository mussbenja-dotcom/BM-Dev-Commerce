import { z } from "zod";
import { db } from "@/lib/db";
import { activeStoreId, jsonError } from "@/lib/store/api";
import { isSameOrigin, clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { applyPaymentResult, PaymentError, startMercadoPagoPayment } from "@/lib/services/payments/mercadopago";

const schema = z.discriminatedUnion("intent", [z.object({ intent: z.literal("retry") }), z.object({ intent: z.literal("demo"), status: z.enum(["PAID", "FAILED", "PENDING"]) })]);
export async function POST(req: Request, ctx: { params: Promise<{ slug: string; token: string }> }) {
  if (!isSameOrigin(req)) return jsonError("Origen no permitido.", 403);
  if (!rateLimit(`payment:${await clientIp()}`, 30, 60_000).ok) return jsonError("Demasiados intentos.", 429);
  const { slug, token } = await ctx.params;
  const storeId = await activeStoreId(slug);
  if (!storeId) return jsonError("Tienda no encontrada.", 404);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Solicitud inválida.");
  const order = await db.order.findFirst({ where: { storeId, publicToken: token, paymentMethod: "MERCADOPAGO" }, include: { store: { include: { settings: true } } } });
  if (!order) return jsonError("Pedido no encontrado.", 404);
  if (order.status === "CANCELLED" || order.paymentStatus === "REFUNDED") return jsonError("Este pedido no admite pagos.");
  const confirmationPath = `/s/${slug}/pedido/${order.publicToken}`;
  try {
    if (parsed.data.intent === "retry") {
      if (order.paymentStatus === "PAID") return Response.json({ url: confirmationPath });
      return Response.json(await startMercadoPagoPayment(storeId, order.id));
    }
    const s = order.store.settings;
    if (!order.store.isDemo || !s?.enableMercadoPago || (s.mpMode !== "DEMO" && s.mpAccessTokenEnc)) return jsonError("La simulación no está habilitada.", 403);
    await applyPaymentResult({ storeId, orderId: order.id, externalId: `demo:${order.id}`, amount: order.total, status: parsed.data.status, demo: true });
    return Response.json({ url: confirmationPath });
  } catch (error) {
    if (error instanceof PaymentError) return jsonError(error.message, error.status);
    return jsonError("No pudimos actualizar el pago. Reintentá.", 503);
  }
}
