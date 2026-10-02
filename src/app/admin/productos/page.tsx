import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ImageOff, Plus, Search } from "lucide-react";
import { requireStoreSession } from "@/lib/auth/session";
import { listAdminProducts, listCategories, type ProductFilters } from "@/lib/services/admin/products";
import { pageParam, strParam } from "@/lib/services/admin/common";
import { formatPrice } from "@/lib/money";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Productos" };

type Search = Promise<Record<string, string | string[] | undefined>>;
const STATUSES = { active: "Visibles", inactive: "Ocultos", low: "Stock bajo" } as const;

export default async function ProductsPage({ searchParams }: { searchParams: Search }) {
  const session = await requireStoreSession();
  const sp = await searchParams;
  const rawStatus = strParam(sp.estado);
  const status = Object.hasOwn(STATUSES, rawStatus) ? (rawStatus as ProductFilters["status"]) : undefined;
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const categories = await listCategories(session.storeId);
  const rawCategory = strParam(sp.categoria, 40);
  const categoryId = categories.some((c) => c.id === rawCategory) ? rawCategory : undefined;
  const { rows, total, pages } = await listAdminProducts(session.storeId, { q, status, categoryId, page });
  const filtered = !!(q || status || categoryId);

  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: q || undefined, estado: status, categoria: categoryId, page: undefined as number | undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") params.set(k, String(v));
    const s = params.toString();
    return `/admin/productos${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Productos" description="Tu catálogo, sus variantes y el stock de cada una.">
        <div className="flex gap-2">
          <Link href="/admin/productos/categorias" className={buttonClasses("secondary", "sm")}>Categorías</Link>
          <Link href="/admin/productos/nuevo" className={buttonClasses("primary", "sm")}><Plus className="size-4" aria-hidden /> Nuevo producto</Link>
        </div>
      </PageHeader>

      <form action="/admin/productos" className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Buscar productos</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Nombre, SKU o marca" className="h-10 pl-9" />
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Categoría</span>
          <Select name="categoria" defaultValue={categoryId ?? ""} className="h-10">
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </label>
        <label className="sm:w-40">
          <span className="sr-only">Estado</span>
          <Select name="estado" defaultValue={status ?? ""} className="h-10">
            <option value="">Todos</option>
            {Object.entries(STATUSES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </label>
        <button type="submit" className={buttonClasses("primary", "sm", "h-10")}>Buscar</button>
      </form>

      <Panel>
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/productos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface sm:px-5">
                  <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface">
                    {p.image ? <Image src={p.image} alt="" fill sizes="48px" className="object-cover" /> : <ImageOff className="size-4 text-muted" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {p.sku} · {p.category?.name ?? "Sin categoría"} · {p.variantCount} {p.variantCount === 1 ? "variante" : "variantes"}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {!p.active ? <Badge tone="neutral">Oculto</Badge> : null}
                      {p.featured ? <Badge tone="violet">Destacado</Badge> : null}
                      {p.lowStock ? <Badge tone="amber">Stock bajo</Badge> : null}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-medium tabular-nums">{formatPrice(p.price)}</span>
                    <span className="block text-xs text-muted tabular-nums">{p.stock} u.</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium">{filtered ? "No hay productos con esos filtros" : "Todavía no cargaste productos"}</p>
            <p className="mt-1 text-sm text-muted">{filtered ? "Probá con otra búsqueda o quitá los filtros." : "Creá tu primer producto para empezar a vender."}</p>
            <Link href={filtered ? "/admin/productos" : "/admin/productos/nuevo"} className={buttonClasses("secondary", "sm", "mt-4")}>
              {filtered ? "Quitar filtros" : "Nuevo producto"}
            </Link>
          </div>
        )}
      </Panel>

      {pages > 1 ? (
        <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{total} productos · página {Math.min(page, pages)} de {pages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={href({ page: page - 1 })} className={buttonClasses("secondary", "sm")} aria-label="Página anterior"><ChevronLeft className="size-4" aria-hidden /></Link> : null}
            {page < pages ? <Link href={href({ page: page + 1 })} className={buttonClasses("secondary", "sm")} aria-label="Página siguiente"><ChevronRight className="size-4" aria-hidden /></Link> : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
