import type { BadgeTone } from "@/components/ui/badge";

export type OrderStatusKey = "NEW" | "CONFIRMED" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type PaymentStatusKey = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type PaymentMethodKey = "MERCADOPAGO" | "TRANSFER" | "CASH" | "WHATSAPP";

export const ORDER_STATUS: Record<OrderStatusKey, { label: string; plural: string; tone: BadgeTone }> = {
  NEW: { label: "Nuevo", plural: "Nuevos", tone: "blue" },
  CONFIRMED: { label: "Confirmado", plural: "Confirmados", tone: "violet" },
  PREPARING: { label: "Preparando", plural: "Preparando", tone: "amber" },
  SHIPPED: { label: "Enviado", plural: "Enviados", tone: "neutral" },
  DELIVERED: { label: "Entregado", plural: "Entregados", tone: "green" },
  CANCELLED: { label: "Cancelado", plural: "Cancelados", tone: "red" },
};

export const ORDER_FLOW: OrderStatusKey[] = ["NEW", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"];

export const PAYMENT_STATUS: Record<PaymentStatusKey, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pago pendiente", tone: "amber" },
  PAID: { label: "Pagado", tone: "green" },
  FAILED: { label: "Pago rechazado", tone: "red" },
  REFUNDED: { label: "Reintegrado", tone: "neutral" },
};

export const PAYMENT_METHOD: Record<PaymentMethodKey, string> = {
  MERCADOPAGO: "Mercado Pago",
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  WHATSAPP: "Acordado por WhatsApp",
};

export const STOCK_REASON: Record<string, string> = {
  INITIAL: "Stock inicial",
  SALE: "Venta",
  ADJUSTMENT: "Ajuste manual",
  CANCEL_RESTOCK: "Pedido cancelado",
};

export const COUPON_TYPE: Record<string, string> = {
  PERCENT: "Porcentaje",
  FIXED: "Monto fijo",
  FREE_SHIPPING: "Envío gratis",
};

const dateFmt = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));
export const formatDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));

/** wa.me link for an Argentine phone as customers type it. */
export function whatsappLink(phone: string, text?: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("54")) digits = `549${digits}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
