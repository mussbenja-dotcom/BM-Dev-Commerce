import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { PaymentStatus } from "@/generated/prisma/client";

const API = "https://api.mercadopago.com";
const PROVIDER = "mercadopago";
const DEMO = "mercadopago_demo";

export class PaymentError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function request(path: string, token: string, init?: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Provider request failed");
    return await response.json();
  } catch {
    // Never expose the provider response (payer details / credentials) to clients or logs.
    throw new PaymentError("Mercado Pago no está disponible. Intentá nuevamente.", 502);
  }
}

export async function startMercadoPagoPayment(storeId: string, orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, storeId, paymentMethod: "MERCADOPAGO" },
    include: { store: { include: { settings: true, domains: { where: { verified: true, isPrimary: true }, take: 1 } } } },
  });
  if (!order || order.store.status !== "ACTIVE") throw new PaymentError("Pedido no disponible.", 404);
  const settings = order.store.settings;
  if (!settings?.enableMercadoPago || order.status === "CANCELLED" || ["PAID", "REFUNDED"].includes(order.paymentStatus)) {
    throw new PaymentError("Este pedido no admite un nuevo pago.");
  }
  if (order.total <= 0) throw new PaymentError("El monto del pedido debe ser mayor a cero.");
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const domain = order.store.domains[0]?.hostname;
  const base = domain ? `https://${domain}` : `${appUrl}/s/${order.store.slug}`;
  const confirmation = `${base}/pedido/${order.publicToken}`;
  if (settings.mpMode === "DEMO" || !settings.mpAccessTokenEnc) {
    if (!order.store.isDemo) throw new PaymentError("El comercio todavía no configuró Mercado Pago.");
    return { url: `${base}/pago/${order.publicToken}`, demo: true };
  }

  const response = await request("/checkout/preferences", decryptSecret(settings.mpAccessTokenEnc), {
    method: "POST",
    body: JSON.stringify({
      // Whole pesos, including shipping and discounts already computed by checkout.
      items: [{ id: order.id, title: `${order.store.name} · Pedido #${order.number}`, quantity: 1, currency_id: "ARS", unit_price: order.total }],
      external_reference: order.id,
      metadata: { store_id: storeId },
      back_urls: { success: confirmation, pending: confirmation, failure: confirmation },
      ...(confirmation.startsWith("https://") ? { auto_return: "approved" } : {}),
      notification_url: `${appUrl}/api/webhooks/mercadopago/${storeId}`,
      payment_methods: { installments: settings.maxInstallments },
    }),
  });
  const preference = z.object({ id: z.string(), init_point: z.url(), sandbox_init_point: z.url().optional() }).safeParse(response);
  if (!preference.success) throw new PaymentError("Respuesta inválida de Mercado Pago.", 502);
  const url = settings.mpMode === "SANDBOX" ? preference.data.sandbox_init_point : preference.data.init_point;
  if (!url) throw new PaymentError("Mercado Pago no devolvió el enlace de prueba.", 502);
  await db.payment.create({ data: { storeId, orderId, provider: PROVIDER, amount: order.total, preferenceId: preference.data.id } });
  return { url, demo: false };
}

type PaymentResult = { storeId: string; orderId: string; externalId: string; amount: number; status: PaymentStatus; demo?: boolean };

/** Only call with a provider-verified response or a guarded demo action. */
export async function applyPaymentResult(result: PaymentResult) {
  return db.$transaction(async (tx) => {
    // Serialize notifications for this order, including simultaneous first notifications.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Order" WHERE id = ${result.orderId} AND "storeId" = ${result.storeId} FOR UPDATE`;
    if (!locked.length) throw new PaymentError("Pedido no encontrado.", 404);
    const order = await tx.order.findFirstOrThrow({ where: { id: result.orderId, storeId: result.storeId }, include: { store: { include: { settings: true } } } });
    if (order.paymentMethod !== "MERCADOPAGO" || order.total !== result.amount) throw new PaymentError("El pago no coincide con el pedido.");
    if (result.demo && (!order.store.isDemo || (order.store.settings?.mpMode !== "DEMO" && order.store.settings?.mpAccessTokenEnc))) {
      throw new PaymentError("La simulación no está habilitada.", 403);
    }
    const provider = result.demo ? DEMO : PROVIDER;
    const previous = await tx.payment.findFirst({ where: { storeId: result.storeId, provider, externalId: result.externalId } });
    if (previous && previous.orderId !== order.id) throw new PaymentError("El pago pertenece a otro pedido.");
    if (previous?.status === result.status || previous?.status === "REFUNDED" || (previous?.status === "PAID" && result.status !== "REFUNDED")) {
      return { changed: false };
    }
    if (previous) {
      await tx.payment.update({ where: { id: previous.id }, data: { status: result.status } });
    } else {
      await tx.payment.create({ data: { storeId: result.storeId, orderId: order.id, provider, externalId: result.externalId, amount: result.amount, status: result.status } });
    }
    const paid = await tx.payment.count({ where: { storeId: result.storeId, orderId: order.id, status: "PAID" } });
    const refunded = await tx.payment.count({ where: { storeId: result.storeId, orderId: order.id, status: "REFUNDED" } });
    const paymentStatus = paid ? "PAID" : refunded ? "REFUNDED" : result.status;
    await tx.order.update({
      where: { id: order.id, storeId: result.storeId },
      data: { paymentStatus, ...(paymentStatus === "PAID" && order.status === "NEW" ? { status: "CONFIRMED" } : {}) },
    });
    await tx.orderEvent.create({ data: {
      storeId: result.storeId, orderId: order.id, type: "payment",
      message: `${result.demo ? "Pago simulado" : "Mercado Pago"}: ${result.status}${order.status === "CANCELLED" && result.status === "PAID" ? ". Pedido cancelado: requiere revisión y devolución." : ""}`,
    } });
    return { changed: true };
  });
}

const providerPaymentSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  external_reference: z.string().min(1),
  transaction_amount: z.number().positive(),
  currency_id: z.literal("ARS"),
  live_mode: z.boolean(),
  status: z.enum(["approved", "pending", "in_process", "authorized", "in_mediation", "rejected", "cancelled", "refunded", "charged_back"]),
  metadata: z.object({ store_id: z.string() }).passthrough(),
});

export async function syncMercadoPagoPayment(storeId: string, paymentId: string) {
  if (!/^\d{1,30}$/.test(paymentId)) throw new PaymentError("Identificador de pago inválido.");
  const settings = await db.storeSettings.findUnique({ where: { storeId } });
  if (!settings?.mpAccessTokenEnc || settings.mpMode === "DEMO") throw new PaymentError("Mercado Pago no está configurado.", 404);
  // Treat the webhook as a notification only. Never trust status/amount from its body.
  const parsed = providerPaymentSchema.safeParse(await request(`/v1/payments/${paymentId}`, decryptSecret(settings.mpAccessTokenEnc)));
  if (!parsed.success) throw new PaymentError("El pago recibido no es válido.");
  const payment = parsed.data;
  if (String(payment.id) !== paymentId || payment.metadata.store_id !== storeId || payment.live_mode !== (settings.mpMode === "PRODUCTION")) {
    throw new PaymentError("El pago no corresponde a este comercio o ambiente.");
  }
  const status: PaymentStatus = payment.status === "approved" ? "PAID"
    : ["refunded", "charged_back"].includes(payment.status) ? "REFUNDED"
    : ["rejected", "cancelled"].includes(payment.status) ? "FAILED" : "PENDING";
  return applyPaymentResult({ storeId, orderId: payment.external_reference, externalId: paymentId, amount: payment.transaction_amount, status });
}
