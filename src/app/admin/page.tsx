import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { requireStoreSession } from "@/lib/auth/session";
import { getDashboard } from "@/lib/services/admin/orders";
import { formatPrice } from "@/lib/money";
import { OrderStatusBadge, PageHeader, Panel, PaymentStatusBadge } from "@/components/admin/order-badges";
import { formatDateTime } from "@/components/admin/labels";

export const metadata: Metadata = { title: "Inicio" };

const weekdayFmt = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short" });

export default async function AdminHome() {
  const session = await requireStoreSession();
  const d = await getDashboard(session.storeId);
  const max = Math.max(1, ...d.days.map((x) => x.total));

  const kpis = [
    { label: "Ventas de hoy", value: formatPrice(d.today.total), hint: `${d.today.count} ${d.today.count === 1 ? "pedido" : "pedidos"}` },
    { label: "Ventas del mes", value: formatPrice(d.month.total), hint: `${d.month.count} ${d.month.count === 1 ? "pedido" : "pedidos"}` },
    { label: "Pedidos nuevos", value: String(d.newCount), hint: "Esperan confirmación", href: "/admin/pedidos?estado=NEW" },
    { label: "Pagos pendientes", value: String(d.awaitingPayment), hint: "Pedidos sin pago acreditado", href: "/admin/pedidos?pago=PENDING" },
  ];

  return (
    <>
      <PageHeader title={`Hola, ${session.name.split(" ")[0]}`} description="Así viene tu tienda. Los importes excluyen pedidos cancelados." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const body = (
            <>
              <p className="text-[13px] text-muted">{k.label}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{k.value}</p>
              <p className="mt-1 text-xs text-muted">{k.hint}</p>
            </>
          );
          return k.href ? (
            <Link key={k.label} href={k.href} className="rounded-xl border border-line bg-bg p-4 transition-colors hover:border-fg/30">
              {body}
            </Link>
          ) : (
            <div key={k.label} className="rounded-xl border border-line bg-bg p-4">
              {body}
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel
          title="Últimos pedidos"
          action={
            <Link href="/admin/pedidos" className="flex items-center gap-1 text-sm text-muted hover:text-fg">
              Ver todos <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          {d.recent.length ? (
            <ul className="divide-y divide-line">
              {d.recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/pedidos/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        #{o.number} · {o.firstName} {o.lastName}
                      </p>
                      <p className="text-xs text-muted">{formatDateTime(o.createdAt)}</p>
                    </div>
                    <div className="hidden flex-col items-end gap-1 sm:flex">
                      <OrderStatusBadge status={o.status} />
                      <PaymentStatusBadge status={o.paymentStatus} />
                    </div>
                    <p className="w-24 text-right text-sm font-medium tabular-nums">{formatPrice(o.total)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted">Todavía no recibiste pedidos. Cuando alguien compre, lo vas a ver acá.</p>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Últimos 7 días">
            <div className="flex h-36 items-end gap-2 px-4 pt-4 pb-3 sm:px-5" role="img" aria-label={`Ventas por día: ${d.days.map((x) => `${weekdayFmt.format(x.date)} ${formatPrice(x.total)}`).join(", ")}`}>
              {d.days.map((x) => (
                <div key={x.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${formatPrice(x.total)} · ${x.count} pedidos`}>
                  <div className="w-full rounded-t-md bg-fg/85" style={{ height: `${Math.max(x.total ? 6 : 2, (x.total / max) * 100)}%`, opacity: x.total ? 1 : 0.15 }} />
                  <span className="text-[11px] text-muted capitalize">{weekdayFmt.format(x.date).replace(".", "")}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Stock bajo">
            {d.lowStock.length ? (
              <ul className="divide-y divide-line">
                {d.lowStock.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{v.product.name}</p>
                      <p className="truncate text-xs text-muted">{[v.option1, v.option2].filter(Boolean).join(" · ") || v.sku}</p>
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${v.stock === 0 ? "text-red-600" : "text-amber-700"}`}>
                      {v.stock === 0 ? "Agotado" : `${v.stock} u.`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 px-5 py-6 text-sm text-muted">
                <CircleCheck className="size-4" aria-hidden /> Ninguna variante con stock bajo.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
