import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";

/**
 * Pure rules for merchant-side order changes. Shared by the server service
 * (which enforces them inside a transaction) and the UI (which only offers
 * allowed actions). No server-only imports.
 */

export const ORDER_FLOW = ["NEW", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"] as const satisfies readonly OrderStatus[];

const CLOSED: readonly OrderStatus[] = ["CANCELLED", "DELIVERED"];

/** Statuses an order can move to (forward only; skipping steps is allowed). */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  if (CLOSED.includes(from)) return [];
  const idx = ORDER_FLOW.indexOf(from as (typeof ORDER_FLOW)[number]);
  return ORDER_FLOW.slice(idx + 1);
}

export function canAdvance(from: OrderStatus, to: OrderStatus): boolean {
  return nextStatuses(from).includes(to);
}

/** Delivered orders are closed: a return is a different process. */
export function canCancel(status: OrderStatus): boolean {
  return !CLOSED.includes(status);
}

/**
 * Cancelling a paid order does not refund the buyer; the merchant must
 * acknowledge that the refund is handled outside this action.
 */
export function cancelNeedsRefundAck(paymentStatus: PaymentStatus): boolean {
  return paymentStatus === "PAID";
}

/**
 * Manual payment changes for methods the platform cannot verify (transfer,
 * cash, WhatsApp). Mercado Pago status only comes from the provider.
 */
export function manualPaymentTargets(order: {
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
}): PaymentStatus[] {
  if (order.paymentMethod === "MERCADOPAGO") return [];
  switch (order.paymentStatus) {
    case "PENDING":
    case "FAILED":
      return order.status === "CANCELLED" ? [] : ["PAID"];
    case "PAID":
      return order.status === "CANCELLED" ? ["REFUNDED"] : ["PENDING", "REFUNDED"];
    case "REFUNDED":
      return [];
  }
}
