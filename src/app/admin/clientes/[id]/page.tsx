import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { requireStoreSession } from "@/lib/auth/session";
import { getCustomer } from "@/lib/services/admin/customers";
import { formatPrice } from "@/lib/money";
import { OrderStatusBadge, PageHeader, Panel, PaymentStatusBadge } from "@/components/admin/order-badges";
import { formatDate, formatDateTime, whatsappLink } from "@/components/admin/labels";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cliente" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStoreSession();
  const { id } = await params;
  const customer = await getCustomer(session.storeId, id.slice(0, 40));
  if (!customer) notFound();
  const name = `${customer.firstName} ${customer.lastName}`;
  const average = customer.ordersCount ? Math.round(customer.totalSpent / customer.ordersCount) : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" aria-hidden /> Clientes</Link>
      <PageHeader title={name} description={`Cliente desde ${formatDate(customer.createdAt)}`}>
        <div className="flex flex-wrap gap-2">
          <a href={`mailto:${customer.email}`} className={buttonClasses("secondary", "sm")}><Mail className="size-4" aria-hidden /> Email</a>
          {customer.phone ? (
            <a href={whatsappLink(customer.phone, `Hola ${customer.firstName}!`)} target="_blank" rel="noopener noreferrer" className={buttonClasses("whatsapp", "sm")}>
              <MessageCircle className="size-4" aria-hidden /> WhatsApp
            </a>
          ) : null}
        </div>
      </PageHeader>

      <dl className="mb-6 grid grid-cols-3 gap-3">
        {[["Pedidos", String(customer.ordersCount)], ["Total comprado", formatPrice(customer.totalSpent)], ["Ticket promedio", formatPrice(average)]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-bg p-3 sm:p-4">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 truncate text-base font-semibold tabular-nums sm:text-lg">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Panel title="Pedidos">
          {customer.orders.length ? (
            <ul className="divide-y divide-line">
              {customer.orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/pedidos/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface sm:px-5">
                    <span>
                      <span className="block text-sm font-medium">Pedido #{o.number}</span>
                      <span className="block text-xs text-muted">{formatDateTime(o.createdAt)}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <OrderStatusBadge status={o.status} />
                      <PaymentStatusBadge status={o.paymentStatus} />
                      <span className="ml-1 text-sm font-medium tabular-nums">{formatPrice(o.total)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="px-5 py-6 text-sm text-muted">Sin pedidos.</p>}
        </Panel>
        <Panel title="Contacto y direcciones">
          <div className="flex flex-col gap-3 p-4 text-sm sm:p-5">
            <p className="break-all">{customer.email}</p>
            {customer.phone ? <p>{customer.phone}</p> : null}
            {customer.addresses.map((a) => (
              <p key={a.id} className="border-t border-line pt-3 text-muted">{a.street}, {a.city}, {a.province} ({a.postalCode})</p>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
