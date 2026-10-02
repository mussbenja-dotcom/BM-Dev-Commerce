import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { requireStoreSession } from "@/lib/auth/session";
import { getOrder } from "@/lib/services/admin/orders";
import { canCancel, manualPaymentTargets, nextStatuses } from "@/lib/services/admin/order-rules";
import { formatPrice } from "@/lib/money";
import { OrderStatusBadge, Panel, PaymentStatusBadge } from "@/components/admin/order-badges";
import { PAYMENT_METHOD, PAYMENT_STATUS, formatDateTime, whatsappLink } from "@/components/admin/labels";
import { CancelForm, NoteForm, PaymentForm, StatusForm } from "@/components/admin/order-actions";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pedido" };

const EVENT_LABEL: Record<string, string> = {
  created: "Pedido creado",
  status: "Cambio de estado",
  payment: "Pago",
  cancelled: "Cancelación",
  note: "Nota interna",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStoreSession();
  const { id } = await params;
  const order = await getOrder(session.storeId, id.slice(0, 40));
  if (!order) notFound();

  const statusOptions = nextStatuses(order.status);
  const paymentTargets = manualPaymentTargets(order);
  const cancellable = canCancel(order.status);
  const discounts = order.discountTotal + order.paymentDiscount;

  const rows: [string, string][] = [
    ["Subtotal", formatPrice(order.subtotal)],
    ...(order.discountTotal ? [[`Cupón ${order.couponCode ?? ""}`.trim(), `− ${formatPrice(order.discountTotal)}`] as [string, string]] : []),
    ...(order.paymentDiscount ? [["Descuento por medio de pago", `− ${formatPrice(order.paymentDiscount)}`] as [string, string]] : []),
    [order.deliveryMethod === "PICKUP" ? "Retiro" : `Envío${order.shippingMethodName ? ` · ${order.shippingMethodName}` : ""}`, order.shippingTotal ? formatPrice(order.shippingTotal) : "Gratis"],
  ];

  return (
    <>
      <Link href="/admin/pedidos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Pedidos
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedido #{order.number}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDateTime(order.createdAt)} · {order.channel === "WHATSAPP" ? "Iniciado por WhatsApp" : "Tienda online"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>

      {order.status === "CANCELLED" && order.paymentStatus === "PAID" ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          Pedido cancelado con pago acreditado. Recordá devolver el dinero al cliente
          {order.paymentMethod === "MERCADOPAGO" ? " desde tu cuenta de Mercado Pago." : " y luego marcar el pago como reintegrado."}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={`Productos (${order.items.reduce((a, i) => a + i.quantity, 0)})`}>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-3 px-4 py-3 sm:px-5">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface">
                    {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" quality={70} /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted">
                      {[item.variantLabel, `SKU ${item.sku}`].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted tabular-nums">
                      {item.quantity} × {formatPrice(item.unitPrice)}
                    </p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">{formatPrice(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="border-t border-line px-4 py-3 text-sm sm:px-5">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-0.5 text-muted">
                  <dt>{k}</dt>
                  <dd className="tabular-nums">{v}</dd>
                </div>
              ))}
              <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(order.total)}</dd>
              </div>
              {discounts ? <p className="mt-1 text-xs text-muted">Incluye {formatPrice(discounts)} de descuentos.</p> : null}
            </dl>
          </Panel>

          <Panel title="Historial">
            <div className="border-b border-line px-4 py-3 sm:px-5">
              <NoteForm orderId={order.id} />
            </div>
            <ol className="px-4 py-2 sm:px-5">
              {order.events.map((e) => (
                <li key={e.id} className="relative border-l border-line py-2 pl-4">
                  <span className="absolute top-3.5 -left-[4.5px] size-2 rounded-full bg-fg/40" aria-hidden />
                  <p className="text-xs text-muted">
                    {EVENT_LABEL[e.type] ?? e.type} · {formatDateTime(e.createdAt)}
                  </p>
                  <p className="text-sm break-words whitespace-pre-line">{e.message}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="order-first flex flex-col gap-4 lg:order-none">
          {statusOptions.length || cancellable ? (
            <Panel title="Gestionar pedido">
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                <StatusForm orderId={order.id} options={statusOptions} />
                {cancellable ? <CancelForm orderId={order.id} number={order.number} paid={order.paymentStatus === "PAID"} /> : null}
              </div>
            </Panel>
          ) : null}

          <Panel title="Cliente">
            <div className="flex flex-col gap-1 p-4 text-sm sm:p-5">
              <p className="font-medium">
                {order.firstName} {order.lastName}
              </p>
              <a href={`mailto:${order.email}`} className="break-all text-muted hover:text-fg">
                {order.email}
              </a>
              <p className="text-muted">{order.phone}</p>
              {order.customer && order.customer.ordersCount > 1 ? (
                <p className="mt-1 text-xs text-muted">
                  {order.customer.ordersCount} pedidos · {formatPrice(order.customer.totalSpent)} en total
                </p>
              ) : null}
              <a
                href={whatsappLink(order.phone, `Hola ${order.firstName}, te escribimos por tu pedido #${order.number}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("whatsapp", "sm", "mt-3")}
              >
                <MessageCircle className="size-4" aria-hidden /> Escribir por WhatsApp
              </a>
            </div>
          </Panel>

          <Panel title={order.deliveryMethod === "PICKUP" ? "Retiro en el local" : "Envío"}>
            <div className="p-4 text-sm sm:p-5">
              {order.deliveryMethod === "SHIPPING" ? (
                <address className="not-italic text-muted">
                  {order.street}
                  <br />
                  {order.city}, {order.province} ({order.postalCode})
                </address>
              ) : (
                <p className="text-muted">El cliente retira el pedido.</p>
              )}
              {order.shippingMethodName ? <p className="mt-2 text-xs text-muted">Método: {order.shippingMethodName}</p> : null}
              {order.notes ? (
                <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm">
                  <span className="block text-xs text-muted">Nota del cliente</span>
                  {order.notes}
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel title="Pago">
            <div className="flex flex-col gap-3 p-4 text-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">{PAYMENT_METHOD[order.paymentMethod]}</span>
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
              {order.payments.length ? (
                <ul className="flex flex-col gap-1 text-xs text-muted">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {p.provider === "mercadopago" ? "Mercado Pago" : p.provider === "mercadopago_demo" ? "Pago simulado" : p.provider} {p.externalId ? `#${p.externalId}` : ""}
                      </span>
                      <span>{PAYMENT_STATUS[p.status].label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {order.paymentMethod === "MERCADOPAGO" ? (
                <p className="text-xs text-muted">El estado se actualiza automáticamente con la confirmación de Mercado Pago.</p>
              ) : (
                <PaymentForm orderId={order.id} targets={paymentTargets} />
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
