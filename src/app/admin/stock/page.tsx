import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { requireStoreSession } from "@/lib/auth/session";
import { listStock, recentMovements, type StockFilter } from "@/lib/services/admin/products";
import { STOCK_REASON_LABEL, isLowStock, variantLabel } from "@/lib/services/admin/product-rules";
import { pageParam, strParam } from "@/lib/services/admin/common";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { formatDateTime } from "@/components/admin/labels";
import { StockForm } from "@/components/admin/product-forms";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Stock" };
type Search = Promise<Record<string, string | string[] | undefined>>;
const FILTERS = [[undefined, "Todo"], ["bajo", "Stock bajo"], ["agotado", "Agotado"]] as const;

export default async function StockPage({ searchParams }: { searchParams: Search }) {
  const session = await requireStoreSession();
  const sp = await searchParams;
  const raw = strParam(sp.filtro);
  const filter: StockFilter = raw === "bajo" || raw === "agotado" ? raw : undefined;
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const [{ rows, total, pages, units, variants }, movements] = await Promise.all([listStock(session.storeId, { q, filter, page }), recentMovements(session.storeId)]);
  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ filtro: filter, q: q || undefined, page: undefined as number | undefined, ...patch })) if (v !== undefined && v !== "") params.set(k, String(v));
    const s = params.toString();
    return `/admin/stock${s ? `?${s}` : ""}`;
  };
  return (
    <>
      <PageHeader title="Stock" description={`${units} unidades a la venta en ${variants} variantes. Cada ajuste queda registrado con su motivo.`} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <nav aria-label="Filtrar stock" className="flex w-max gap-1 rounded-xl border border-line bg-bg p-1">
          {FILTERS.map(([key, label]) => (
            <Link key={label} href={href({ filtro: key })} aria-current={key === filter ? "page" : undefined}
              className={cn("flex h-8 items-center rounded-lg px-3 text-sm", key === filter ? "bg-fg text-bg" : "text-muted hover:text-fg")}>{label}</Link>
          ))}
        </nav>
        <form action="/admin/stock" className="flex flex-1 gap-2" role="search">
          {filter ? <input type="hidden" name="filtro" value={filter} /> : null}
          <label className="relative flex-1">
            <span className="sr-only">Buscar en stock</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Producto o SKU" className="h-10 pl-9" />
          </label>
          <button type="submit" className={buttonClasses("primary", "sm", "h-10")}>Buscar</button>
        </form>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          <Panel>
            {rows.length ? (
              <ul className="divide-y divide-line">
                {rows.map((v) => {
                  const label = `${v.product.name} · ${variantLabel(v)}`;
                  return (
                    <li key={v.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                      <div className="min-w-40 flex-1">
                        <Link href={`/admin/productos/${v.product.id}`} className="text-sm font-medium hover:underline">{v.product.name}</Link>
                        <p className="text-xs text-muted">{variantLabel(v)} · {v.sku}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge tone={v.stock === 0 ? "red" : isLowStock(v) ? "amber" : "green"}>{v.stock} en stock</Badge>
                          {!v.active || !v.product.active ? <Badge tone="neutral">No a la venta</Badge> : null}
                        </div>
                      </div>
                      <div className="w-full sm:w-auto"><StockForm variantId={v.id} stock={v.stock} label={label} /></div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="px-5 py-10 text-center text-sm text-muted">{filter || q ? "Nada para mostrar con esos filtros." : "Todavía no cargaste productos."}</p>}
          </Panel>
          {pages > 1 ? (
            <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>{total} variantes · página {Math.min(page, pages)} de {pages}</span>
              <div className="flex gap-2">
                {page > 1 ? <Link href={href({ page: page - 1 })} className={buttonClasses("secondary", "sm")} aria-label="Página anterior"><ChevronLeft className="size-4" aria-hidden /></Link> : null}
                {page < pages ? <Link href={href({ page: page + 1 })} className={buttonClasses("secondary", "sm")} aria-label="Página siguiente"><ChevronRight className="size-4" aria-hidden /></Link> : null}
              </div>
            </nav>
          ) : null}
        </div>
        <Panel title="Últimos movimientos">
          {movements.length ? (
            <ul className="divide-y divide-line text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.variant.product.name}</span>
                    <span className="block truncate text-xs text-muted">{STOCK_REASON_LABEL[m.reason]} · {variantLabel(m.variant)}{m.note ? ` · ${m.note}` : ""}</span>
                    <span className="block text-xs text-muted">{formatDateTime(m.createdAt)}</span>
                  </span>
                  <span className={cn("shrink-0 tabular-nums", m.delta > 0 ? "text-emerald-700" : "text-red-700")}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                </li>
              ))}
            </ul>
          ) : <p className="px-5 py-6 text-sm text-muted">Sin movimientos todavía.</p>}
        </Panel>
      </div>
    </>
  );
}
