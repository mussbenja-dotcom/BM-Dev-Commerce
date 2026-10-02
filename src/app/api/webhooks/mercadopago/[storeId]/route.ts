import { z } from "zod";
import { PaymentError, syncMercadoPagoPayment } from "@/lib/services/payments/mercadopago";

const notificationSchema = z.object({
  type: z.string(),
  data: z.object({ id: z.union([z.string(), z.number().int().positive()]) }).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ storeId: string }> }) {
  const notification = notificationSchema.safeParse(await req.json().catch(() => null));
  if (!notification.success) return Response.json({ error: "Notificación inválida." }, { status: 400 });
  if (notification.data.type !== "payment") return Response.json({ received: true });
  const id = String(notification.data.data?.id ?? "");
  if (!/^\d{1,30}$/.test(id)) return Response.json({ error: "Identificador inválido." }, { status: 400 });
  try {
    const { storeId } = await ctx.params;
    await syncMercadoPagoPayment(storeId, id);
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof PaymentError) return Response.json({ error: error.message }, { status: error.status });
    // A retryable failure must not acknowledge a payment we failed to persist.
    return Response.json({ error: "No se pudo procesar el pago." }, { status: 503 });
  }
}
