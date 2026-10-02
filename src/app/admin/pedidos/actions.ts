"use server";

import { z } from "zod";
import { requireStoreSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { ok, revalidateStore, run, zf } from "@/lib/services/admin/common";
import type { ActionResult, ActionState } from "@/lib/services/admin/types";
import { addOrderNote, advanceOrderStatus, cancelOrder, setManualPaymentStatus, type Actor } from "@/lib/services/admin/orders";

const orderId = z.string().trim().min(1).max(40);

async function actor(): Promise<Actor> {
  const session = await requireStoreSession();
  return { storeId: session.storeId, userId: session.userId };
}

async function done(a: Actor, action: string, id: string, message: string, meta?: Record<string, unknown>): Promise<ActionResult> {
  await audit({ action, storeId: a.storeId, userId: a.userId, entity: "order", entityId: id, meta });
  await revalidateStore(a.storeId);
  return ok(message);
}

const statusSchema = z.object({ orderId, status: z.enum(["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"]) });

export async function updateOrderStatusAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const input = statusSchema.parse({ orderId: fd.get("orderId"), status: fd.get("status") });
    const r = await advanceOrderStatus(a, input.orderId, input.status);
    return done(a, "order.status", input.orderId, `Pedido #${r.number} actualizado.`, { from: r.from, to: r.to });
  });
}

const cancelSchema = z.object({
  orderId,
  reason: zf.optional(300),
  refundAcknowledged: zf.bool,
});

export async function cancelOrderAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const input = cancelSchema.parse({
      orderId: fd.get("orderId"),
      reason: fd.get("reason") ?? "",
      refundAcknowledged: fd.get("refundAcknowledged") ?? "",
    });
    const r = await cancelOrder(a, input.orderId, { reason: input.reason, refundAcknowledged: input.refundAcknowledged });
    // Restocked products change availability on the storefront.
    await revalidateStore(a.storeId, { storefront: true });
    return done(a, "order.cancel", input.orderId, `Pedido #${r.number} cancelado. Stock repuesto.`, { restocked: r.restocked, missing: r.missing });
  });
}

const paymentSchema = z.object({ orderId, paymentStatus: z.enum(["PENDING", "PAID", "REFUNDED"]) });

export async function updatePaymentStatusAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const input = paymentSchema.parse({ orderId: fd.get("orderId"), paymentStatus: fd.get("paymentStatus") });
    const r = await setManualPaymentStatus(a, input.orderId, input.paymentStatus);
    return done(a, "order.payment", input.orderId, `Pago del pedido #${r.number} actualizado.`, { to: input.paymentStatus });
  });
}

const noteSchema = z.object({ orderId, message: zf.required(500, "Escribí la nota.") });

export async function addOrderNoteAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const input = noteSchema.parse({ orderId: fd.get("orderId"), message: fd.get("message") ?? "" });
    await addOrderNote(a, input.orderId, input.message);
    return done(a, "order.note", input.orderId, "Nota agregada.");
  });
}
