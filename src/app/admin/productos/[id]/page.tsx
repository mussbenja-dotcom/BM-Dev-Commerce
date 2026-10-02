import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireStoreSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getAdminProduct, getStockHistory, listCategories } from "@/lib/services/admin/products";
import { STOCK_REASON_LABEL, isLowStock, variantLabel } from "@/lib/services/admin/product-rules";
import { formatPrice } from "@/lib/money";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { formatDateTime } from "@/components/admin/labels";
import { EditVariantToggle, ProductActiveForm, ProductForm, StockForm, VariantForm } from "@/components/admin/product-forms";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Producto" };

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string }> }) {
  const session = await requireStoreSession();
  const { id } = await params;
  const { creado } = await searchParams;
  const product = await getAdminProduct(session.storeId, id.slice(0, 40));
  if (!product) notFound();
  const [categories, history, store] = await Promise.all([
    listCategories(session.storeId),
    getStockHistory(session.storeId, product.id),
    db.store.findUniqueOrThrow({ where: { id: session.storeId }, select: { slug: true } }),
  ]);
  const optionNames: [string, string] = [product.option1Name ?? "", product.option2Name ?? ""];
  const totalStock = product.variants.filter((v) => v.active).reduce((s, v) => s + v.stock, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/productos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" aria-hidden /> Productos</Link>
      <PageHeader title={product.name} description={`${product.sku} · ${formatPrice(product.price)} · ${totalStock} unidades a la venta`}>
        <div className="flex flex-wrap items-start gap-2">
          {product.active ? (
            <Link href={`/s/${store.slug}/productos/${product.slug}`} target="_blank" className="inline-flex h-9 items-center gap-1.5 px-2 text-sm text-muted hover:text-fg">
              Ver en la tienda <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          ) : <Badge tone="neutral">Oculto en la tienda</Badge>}
          <ProductActiveForm productId={product.id} active={product.active} />
        </div>
      </PageHeader>
      {creado ? <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">Producto creado. Si tiene talles o colores, agregá sus variantes acá abajo.</p> : null}

      <div className="flex flex-col gap-6">
        <Panel title="Variantes y stock">
          <ul className="divide-y divide-line">
            {product.variants.map((v) => {
              const label = variantLabel(v);
              return (
                <li key={v.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium">
                      {v.colorHex ? <span className="mr-1.5 inline-block size-3 rounded-full border border-line align-middle" style={{ background: v.colorHex }} aria-hidden /> : null}
                      {label}
                    </p>
                    <p className="text-xs text-muted">{v.sku} · {formatPrice(v.price ?? product.price)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone={v.stock === 0 ? "red" : isLowStock(v) ? "amber" : "green"}>{v.stock} en stock</Badge>
                      {!v.active ? <Badge tone="neutral">No a la venta</Badge> : null}
                    </div>
                  </div>
                  <div className="w-full sm:w-auto"><StockForm variantId={v.id} stock={v.stock} label={label} /></div>
                  <EditVariantToggle
                    productId={product.id}
                    optionNames={optionNames}
                    variant={{ id: v.id, sku: v.sku, option1: v.option1 ?? "", option2: v.option2 ?? "", colorHex: v.colorHex ?? "", price: v.price?.toString() ?? "", lowStockAlert: String(v.lowStockAlert), active: v.active }}
                  />
                </li>
              );
            })}
          </ul>
          <details className="border-t border-line px-4 py-4 sm:px-5">
            <summary className="cursor-pointer text-sm font-medium">Agregar variante</summary>
            <div className="mt-4">
              <VariantForm productId={product.id} optionNames={optionNames} variant={{ sku: `${product.sku}-${product.variants.length + 1}`, option1: "", option2: "", colorHex: "", price: "", lowStockAlert: "3", active: true }} />
            </div>
          </details>
        </Panel>

        <Panel title="Historial de stock">
          {history.length ? (
            <ul className="divide-y divide-line text-sm">
              {history.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0">
                    <span className="font-medium">{STOCK_REASON_LABEL[m.reason]}</span>
                    <span className="text-muted"> · {variantLabel(m.variant)} ({m.variant.sku})</span>
                    {m.note ? <span className="block truncate text-xs text-muted">{m.note}</span> : null}
                    <span className="block text-xs text-muted">{formatDateTime(m.createdAt)}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className={m.delta > 0 ? "text-emerald-700" : "text-red-700"}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                    <span className="block text-xs text-muted">queda {m.stockAfter}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="px-5 py-6 text-sm text-muted">Todavía no hay movimientos de stock.</p>}
        </Panel>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Datos del producto</h2>
          <ProductForm
            categories={categories}
            product={{
              id: product.id, name: product.name, slug: product.slug, description: product.description, categoryId: product.categoryId ?? "",
              brand: product.brand ?? "", sku: product.sku, price: String(product.price), compareAtPrice: product.compareAtPrice?.toString() ?? "",
              option1Name: product.option1Name ?? "", option2Name: product.option2Name ?? "", active: product.active, featured: product.featured, isNew: product.isNew,
              seoTitle: product.seoTitle ?? "", seoDescription: product.seoDescription ?? "", images: product.images.map((i) => i.url).join("\n"),
            }}
          />
        </div>
      </div>
    </div>
  );
}
