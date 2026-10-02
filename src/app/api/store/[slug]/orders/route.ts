import { z } from "zod";
import { db } from "@/lib/db";
import { checkoutSchema, CheckoutError, createOrder } from "@/lib/services/checkout";
import { PaymentError, startMercadoPagoPayment } from "@/lib/services/payments/mercadopago";
import { getOrderWhatsappUrl } from "@/lib/services/order-links";
import { activeStoreId, jsonError } from "@/lib/store/api";
import { clientIp, isSameOrigin } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeWhatsapp } from "@/lib/whatsapp";

const schema = checkoutSchema.extend({ checkoutKey: z.uuid() });
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!isSameOrigin(req)) return jsonError("Origen no permitido.", 403);
  if (!rateLimit(`checkout:${await clientIp()}`, 20, 60_000).ok) return jsonError("Demasiados intentos. Esperá un minuto.", 429);
  const { slug } = await ctx.params;
  const storeId = await activeStoreId(slug);
  if (!storeId) return jsonError("Tienda no encontrada.", 404);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Revisá los datos del pedido.");
  const input = parsed.data;
  const findExisting = () => db.order.findUnique({ where: { storeId_checkoutKey: { storeId, checkoutKey: input.checkoutKey } } });
  try {
    const settings = await db.storeSettings.findUnique({ where: { storeId }, include: { store: { select: { isDemo: true } } } });
    if (input.paymentMethod === "WHATSAPP" && !normalizeWhatsapp(settings?.whatsapp)) throw new CheckoutError("El comercio todavía no configuró WhatsApp.");
    if (input.paymentMethod === "MERCADOPAGO" && !settings?.store.isDemo && (settings?.mpMode === "DEMO" || !settings?.mpAccessTokenEnc)) throw new CheckoutError("El comercio todavía no configuró Mercado Pago.");
    let order = await findExisting();
    if (!order) {
      try {
        const created = await createOrder(storeId, input, input.checkoutKey);
        order = await db.order.findFirstOrThrow({ where: { id: created.order.id, storeId } });
      } catch (error) {
        // A competing retry may have committed while we waited on the stock row.
        order = await findExisting();
        if (!order) throw error;
      }
    }
    const confirmationPath = `/s/${slug}/pedido/${order.publicToken}`;
    if (order.paymentMethod === "WHATSAPP") return Response.json({ confirmationPath, url: await getOrderWhatsappUrl(storeId, order.id) ?? confirmationPath }, { status: 201 });
    if (order.paymentMethod === "MERCADOPAGO" && !["PAID", "REFUNDED"].includes(order.paymentStatus) && order.status !== "CANCELLED") {
      try {
        const payment = await startMercadoPagoPayment(storeId, order.id);
        return Response.json({ confirmationPath, ...payment }, { status: 201 });
      } catch (error) {
        // The order/stock already committed. Give the buyer a recovery link instead of creating another order.
        return Response.json({ confirmationPath, url: confirmationPath, paymentError: error instanceof PaymentError ? error.message : "No pudimos iniciar el pago. Podés reintentarlo desde tu pedido." }, { status: 201 });
      }
    }
    return Response.json({ confirmationPath, url: confirmationPath }, { status: 201 });
  } catch (error) {
    if (error instanceof CheckoutError) return jsonError(error.message);
    return jsonError("No pudimos confirmar el pedido. Reintentá con los mismos datos.", 503);
  }
}
