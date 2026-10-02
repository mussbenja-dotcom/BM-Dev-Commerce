import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getStoreBySlug, getStoreBase } from "@/lib/store/resolve";
import { getOrderWhatsappUrl } from "@/lib/services/order-links";
import { PaymentControls } from "@/components/store/payment-controls";
import { formatPrice } from "@/lib/money";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Tu pedido", robots: { index: false, follow: false } };
export default async function OrderPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const store = await getStoreBySlug(slug);
  if (!store?.settings) notFound();
  const order = await db.order.findFirst({ where: { storeId: store.id, publicToken: token }, include: { items: true } });
  if (!order) notFound();
  const base = await getStoreBase(slug);
  const whatsapp = await getOrderWhatsappUrl(store.id, order.id);
  const status = { NEW: "Recibido", CONFIRMED: "Confirmado", PREPARING: "En preparación", SHIPPED: "Enviado", DELIVERED: "Entregado", CANCELLED: "Cancelado" };
  const payment = { PENDING: "Pendiente", PAID: "Pagado", FAILED: "Rechazado", REFUNDED: "Reembolsado" };
  return <div className="mx-auto max-w-3xl px-5 py-14"><p className="mb-3 text-xs uppercase tracking-widest text-muted">{store.name}</p><h1 className="font-heading text-3xl">Pedido #{order.number}</h1><p className="mt-4 text-sm">Gracias, {order.firstName}. Guardá este enlace para consultar el estado de tu pedido.</p><div className="my-7 flex flex-wrap gap-3 text-sm"><span className="rounded-theme bg-surface px-4 py-2">Pedido: {status[order.status]}</span><span className="rounded-theme bg-surface px-4 py-2" data-testid="payment-status">Pago: {payment[order.paymentStatus]}</span></div>
    {order.paymentMethod === "MERCADOPAGO" && !["PAID", "REFUNDED"].includes(order.paymentStatus) && order.status !== "CANCELLED" && <div className="mb-8 space-y-4 border border-line p-5"><p className="text-sm">{order.paymentStatus === "FAILED" ? "El pago fue rechazado. Podés volver a intentarlo." : "Todavía no recibimos la confirmación del pago. Si ya pagaste, actualizá esta página en unos instantes."}</p><PaymentControls token={token} /><a href={`${base}/pedido/${token}`} className="inline-block text-sm underline">Actualizar estado</a></div>}
    {order.paymentMethod === "TRANSFER" && order.paymentStatus === "PENDING" && order.status !== "CANCELLED" && <section className="mb-8 space-y-3 rounded-theme bg-surface p-6"><h2 className="font-heading text-xl">Datos para transferir</h2><p className="text-sm">Transferí {formatPrice(order.total)} e indicá el número de pedido al enviar el comprobante al comercio.</p><dl className="space-y-2 text-sm">{[["Banco", store.settings.bankName], ["Titular", store.settings.bankHolder], ["Alias", store.settings.bankAlias], ["CBU", store.settings.bankCbu], ["CUIT", store.settings.bankCuit]].map(([label, value]) => value && <div key={label}><dt className="font-medium">{label}</dt><dd className="break-all">{value}</dd></div>)}</dl>{!store.settings.bankAlias && !store.settings.bankCbu && <p className="text-sm">Contactá al comercio para recibir los datos de la cuenta.</p>}</section>}
    {order.paymentMethod === "CASH" && <p className="mb-8 text-sm">Pago en efectivo: coordiná la entrega con el comercio.</p>}
    <section><h2 className="mb-4 font-heading text-xl">Detalle de tu compra</h2><ul className="divide-y divide-line">{order.items.map((item) => <li key={item.id} className="flex justify-between gap-4 py-4 text-sm"><div>{item.quantity} × {item.productName}<p className="mt-1 text-xs text-muted">{item.variantLabel}</p></div><span>{formatPrice(item.lineTotal)}</span></li>)}</ul><dl className="mt-4 space-y-3 border-t border-line pt-5 text-sm">{[["Subtotal", order.subtotal], ["Descuentos", -(order.discountTotal + order.paymentDiscount)], ["Envío", order.shippingTotal], ["Total", order.total]].map(([label, amount]) => <div key={label} className={`flex justify-between ${label === "Total" ? "text-lg font-semibold" : ""}`}><dt>{label}</dt><dd>{formatPrice(Number(amount))}</dd></div>)}</dl></section>
    <section className="my-8 border-y border-line py-6"><h2 className="mb-3 font-heading text-xl">Entrega</h2><p className="text-sm">{order.shippingMethodName}</p><p className="mt-2 text-sm text-muted">{order.deliveryMethod === "PICKUP" ? [store.settings.address, store.settings.city, store.settings.hours].filter(Boolean).join(" · ") : [order.street, order.city, order.province, order.postalCode].filter(Boolean).join(", ")}</p></section>
    <div className="flex flex-wrap gap-3">{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className={buttonClasses("whatsapp")}>{order.paymentMethod === "WHATSAPP" ? "Enviar pedido por WhatsApp" : "Contactar al comercio"}</a>}<Link href={base || "/"} className={buttonClasses("secondary")}>Seguir comprando</Link></div>
  </div>;
}
