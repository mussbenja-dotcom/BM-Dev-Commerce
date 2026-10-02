import "server-only";
import { db } from "@/lib/db";
import { orderMessage, whatsappUrl } from "@/lib/whatsapp";

export async function getOrderWhatsappUrl(storeId: string, orderId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, storeId }, include: { items: true, store: { include: { settings: true } } } });
  if (!order) return null;
  return whatsappUrl(order.store.settings?.whatsapp, orderMessage({
    storeName: order.store.name, orderNumber: order.number,
    lines: order.items.map((i) => ({ name: i.productName, variant: i.variantLabel, quantity: i.quantity, unitPrice: i.unitPrice })),
    subtotal: order.subtotal, couponCode: order.couponCode, discount: order.discountTotal + order.paymentDiscount,
    shipping: order.shippingTotal, total: order.total, customerName: `${order.firstName} ${order.lastName}`,
    delivery: order.deliveryMethod, shippingMethodName: order.shippingMethodName,
    address: [order.street, order.city, order.province, order.postalCode].filter(Boolean).join(", "),
    paymentLabel: order.paymentMethod === "WHATSAPP" ? "A coordinar por WhatsApp" : order.paymentMethod,
    notes: order.notes,
  }));
}
