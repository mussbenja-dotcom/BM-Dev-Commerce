import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { requireStoreSession } from "@/lib/auth/session";
import { listOrders } from "@/lib/services/admin/orders";
import { pageParam, strParam } from "@/lib/services/admin/common";
import { formatPrice } from "@/lib/money";
import { OrderStatusBadge, PageHeader, Panel, PaymentStatusBadge } from "@/components/admin/order-badges";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, formatDateTime, type OrderStatusKey, type PaymentStatusKey } from "@/components/admin/labels";
import { Input, Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Pedidos" };

type Search = Promise<Record<string, string | string[] | undefined>>;

const STATUS_KEYS = Object.keys(ORDER_STATUS) as OrderStatusKey[];
const PAYMENT_KEYS = Object.keys(PAYMENT_STATUS) as PaymentStatusKey[];

export default async function OrdersPage({ searchParams }: { searchParams: Search }) {
  const session = await requireStoreSession();
  const sp = await searchParams;
  const rawStatus = strParam(sp.estado);
  const rawPayment = strParam(sp.pago);
  const status = STATUS_KEYS.includes(rawStatus as OrderStatusKey) ? (rawStatus as OrderStatusKey) : undefined;
  const payment = PAYMENT_KEYS.includes(rawPayment as PaymentStatusKey) ? (rawPayment as PaymentStatusKey) : undefined;
  const q = strParam(sp.q);
  const page = pageParam(sp.page);

  const { rows, total, pages, byStatus } = await listOrders(session.storeId, { status, payment, q, page });
  const allCount = Object.values(byStatus).reduce((a, b) => a + (b ?? 0), 0);

  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { estado: status, pago: payment, q: q || undefined, page: undefined as number | undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") params.set(k, String(v));
    const s = params.toString();
    return `/admin/pedidos${s ? `?${s}` : ""}`;
  };

  const tabs: { key?: OrderStatusKey; label: string; count: number }[] = [
    { label: "Todos", count: allCount },
    ...STATUS_KEYS.map((k) => ({ key: k, label: ORDER_STATUS[k].plural, count: byStatus[k] ?? 0 })),
  ];

  return (
    <>
      <PageHeader title="Pedidos" description="Seguí cada compra desde que entra hasta que se entrega." />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <nav aria-label="Filtrar por estado" className="flex w-max gap-1 rounded-xl border border-line bg-bg p-1">
          {tabs.map((t) => {
            const active = t.key === status;
            return (
              <Link
                key={t.label}
                href={href({ estado: t.key })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm whitespace-nowrap transition-colors",
                  active ? "bg-fg text-bg" : "text-muted hover:text-fg",
                )}
              >
                {t.label}
                <span className={cn("text-xs tabular-nums", active ? "text-bg/70" : "text-muted/70")}>{t.count}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <form action="/admin/pedidos" className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        {status ? <input type="hidden" name="estado" value={status} /> : null}
        <label className="relative flex-1">
          <span className="sr-only">Buscar pedidos</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Número, nombre, email o teléfono" className="h-10 pl-9" />
        </label>
        <label className="sm:w-52">
          <span className="sr-only">Estado del pago</span>
          <Select name="pago" defaultValue={payment ?? ""} className="h-10">
            <option value="">Todos los pagos</option>
            {PAYMENT_KEYS.map((k) => (
              <option key={k} value={k}>
                {PAYMENT_STATUS[k].label}
              </option>
            ))}
          </Select>
        </label>
        <button type="submit" className={buttonClasses("primary", "sm", "h-10")}>
          Buscar
        </button>
      </form>

      <Panel>
        {rows.length ? (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="px-5 py-3 font-medium">Pedido</th>
                  <th scope="col" className="px-3 py-3 font-medium">Cliente</th>
                  <th scope="col" className="px-3 py-3 font-medium">Estado</th>
                  <th scope="col" className="px-3 py-3 font-medium">Pago</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((o) => (
                  <tr key={o.id} className="relative hover:bg-surface">
                    <td className="px-5 py-3">
                      <Link href={`/admin/pedidos/${o.id}`} className="font-medium after:absolute after:inset-0">
                        #{o.number}
                      </Link>
                      <p className="text-xs text-muted">{formatDateTime(o.createdAt)}</p>
                    </td>
                    <td className="px-3 py-3">
                      {o.firstName} {o.lastName}
                      <p className="text-xs text-muted">
                        {o._count.items} {o._count.items === 1 ? "producto" : "productos"} · {o.deliveryMethod === "PICKUP" ? "Retiro" : "Envío"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-3 py-3">
                      <PaymentStatusBadge status={o.paymentStatus} />
                      <p className="mt-0.5 text-xs text-muted">{PAYMENT_METHOD[o.paymentMethod]}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums">{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-line md:hidden">
              {rows.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/pedidos/${o.id}`} className="block px-4 py-3 active:bg-surface">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium">
                        #{o.number} · {o.firstName} {o.lastName}
                      </p>
                      <p className="text-sm font-medium tabular-nums">{formatPrice(o.total)}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDateTime(o.createdAt)} · {PAYMENT_METHOD[o.paymentMethod]}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <OrderStatusBadge status={o.status} />
                      <PaymentStatusBadge status={o.paymentStatus} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium">No hay pedidos para mostrar</p>
            <p className="mt-1 text-sm text-muted">
              {q || status || payment ? "Probá con otra búsqueda o quitá los filtros." : "Cuando alguien compre en tu tienda, el pedido aparece acá."}
            </p>
            {q || status || payment ? (
              <Link href="/admin/pedidos" className={buttonClasses("secondary", "sm", "mt-4")}>
                Quitar filtros
              </Link>
            ) : null}
          </div>
        )}
      </Panel>

      {pages > 1 ? (
        <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            {total} pedidos · página {Math.min(page, pages)} de {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={href({ page: page - 1 })} className={buttonClasses("secondary", "sm")} aria-label="Página anterior">
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={href({ page: page + 1 })} className={buttonClasses("secondary", "sm")} aria-label="Página siguiente">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
