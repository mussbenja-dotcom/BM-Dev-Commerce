import { formatPrice } from "@/lib/money";

export function normalizeWhatsapp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export function whatsappUrl(phone: string | null | undefined, text: string): string | null {
  const number = normalizeWhatsapp(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function productInquiryMessage(p: { name: string; variant?: string | null; url: string }) {
  const variant = p.variant ? ` (${p.variant})` : "";
  return `Hola! Quería consultar por ${p.name}${variant}.\n${p.url}`;
}

export type WhatsappOrder = {
  storeName: string;
  orderNumber?: number | null;
  lines: { name: string; variant: string | null; quantity: number; unitPrice: number }[];
  subtotal: number;
  couponCode?: string | null;
  discount: number;
  shipping: number;
  total: number;
  customerName: string;
  delivery: "SHIPPING" | "PICKUP";
  shippingMethodName?: string | null;
  address?: string | null;
  paymentLabel?: string | null;
  notes?: string | null;
};

export function orderMessage(o: WhatsappOrder): string {
  const out: string[] = [];
  out.push(
    o.orderNumber
      ? `Hola ${o.storeName}! Quiero realizar este pedido (#${o.orderNumber}):`
      : `Hola ${o.storeName}! Quiero realizar este pedido:`,
  );
  out.push("");
  for (const l of o.lines) {
    out.push(`Producto: ${l.name}`);
    if (l.variant) out.push(`Variante: ${l.variant}`);
    out.push(`Cantidad: ${l.quantity}`);
    out.push(`Precio: ${formatPrice(l.unitPrice * l.quantity)}`);
    out.push("");
  }
  out.push(`Subtotal: ${formatPrice(o.subtotal)}`);
  if (o.discount > 0) {
    out.push(`Descuento${o.couponCode ? ` (${o.couponCode})` : ""}: -${formatPrice(o.discount)}`);
  }
  out.push(`Envío: ${o.delivery === "PICKUP" ? "Retiro en el local" : o.shipping === 0 ? "Gratis" : formatPrice(o.shipping)}`);
  out.push(`Total: ${formatPrice(o.total)}`);
  out.push("");
  out.push(`Nombre: ${o.customerName}`);
  if (o.delivery === "SHIPPING" && o.address) out.push(`Dirección: ${o.address}`);
  out.push(
    `Forma de entrega: ${o.delivery === "PICKUP" ? "Retiro en el local" : `Envío a domicilio${o.shippingMethodName ? ` (${o.shippingMethodName})` : ""}`}`,
  );
  if (o.paymentLabel) out.push(`Pago: ${o.paymentLabel}`);
  if (o.notes) out.push(`Notas: ${o.notes}`);
  return out.join("\n");
}
