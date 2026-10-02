import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { requireStoreSession } from "@/lib/auth/session";
import { CUSTOMER_SORTS, listCustomers, type CustomerSort } from "@/lib/services/admin/customers";
import { pageParam, strParam } from "@/lib/services/admin/common";
import { formatPrice } from "@/lib/money";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { formatDate } from "@/components/admin/labels";
import { Input, Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Clientes" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams: Search }) {
  const session = await requireStoreSession();
  const sp = await searchParams;
  const rawSort = strParam(sp.orden);
  const sort: CustomerSort = Object.hasOwn(CUSTOMER_SORTS, rawSort) ? (rawSort as CustomerSort) : "recientes";
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const { rows, total, pages, storeTotals } = await listCustomers(session.storeId, { q, sort, page });

  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: q || undefined, orden: sort === "recientes" ? undefined : sort, page: undefined as number | undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") params.set(k, String(v));
    const s = params.toString();
    return `/admin/clientes${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Clientes" description={`${storeTotals.customers} clientes · ${formatPrice(storeTotals.spent)} comprados en total. Se agregan solos con cada compra.`}>
        {storeTotals.customers ? (
          <a href="/admin/clientes/exportar" className={buttonClasses("secondary", "sm")} download>
            <Download className="size-4" aria-hidden /> Exportar CSV
          </a>
        ) : null}
      </PageHeader>

      <form action="/admin/clientes" className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Buscar clientes</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Nombre, email o teléfono" className="h-10 pl-9" />
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Ordenar</span>
          <Select name="orden" defaultValue={sort} className="h-10">
            {Object.entries(CUSTOMER_SORTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </label>
        <button type="submit" className={buttonClasses("primary", "sm", "h-10")}>Buscar</button>
      </form>

      <Panel>
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/clientes/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.firstName} {c.lastName}</span>
                    <span className="block truncate text-xs text-muted">{c.email}{c.phone ? ` · ${c.phone}` : ""}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium tabular-nums">{formatPrice(c.totalSpent)}</span>
                    <span className="block text-xs text-muted">{c.ordersCount} {c.ordersCount === 1 ? "pedido" : "pedidos"} · desde {formatDate(c.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium">{q ? "No encontramos clientes con esa búsqueda" : "Todavía no tenés clientes"}</p>
            <p className="mt-1 text-sm text-muted">{q ? "Probá con otro nombre, email o teléfono." : "Cuando alguien compre en tu tienda, aparece acá."}</p>
          </div>
        )}
      </Panel>

      {pages > 1 ? (
        <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{total} clientes · página {Math.min(page, pages)} de {pages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={href({ page: page - 1 })} className={buttonClasses("secondary", "sm")} aria-label="Página anterior"><ChevronLeft className="size-4" aria-hidden /></Link> : null}
            {page < pages ? <Link href={href({ page: page + 1 })} className={buttonClasses("secondary", "sm")} aria-label="Página siguiente"><ChevronRight className="size-4" aria-hidden /></Link> : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
