import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStoreSession } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/admin/products";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { CategoryForm } from "@/components/admin/product-forms";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Categorías" };

export default async function CategoriesPage() {
  const session = await requireStoreSession();
  const categories = await listCategories(session.storeId);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/productos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" aria-hidden /> Productos</Link>
      <PageHeader title="Categorías" description="Ordenan tu tienda y el menú. Las ocultas no se muestran a tus clientes." />
      <Panel title="Nueva categoría" className="mb-6">
        <div className="p-4 sm:p-5"><CategoryForm category={{ name: "", description: "", imageUrl: "", position: String(categories.length), active: true }} /></div>
      </Panel>
      <Panel title={`Tus categorías (${categories.length})`}>
        {categories.length ? (
          <ul className="divide-y divide-line">
            {categories.map((c) => (
              <li key={c.id}>
                <details className="group px-4 py-3 sm:px-5">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {!c.active ? <Badge tone="neutral">Oculta</Badge> : null}
                      {c._count.products} {c._count.products === 1 ? "producto" : "productos"}
                    </span>
                  </summary>
                  <div className="mt-4">
                    <CategoryForm category={{ id: c.id, name: c.name, description: c.description ?? "", imageUrl: c.imageUrl ?? "", position: String(c.position), active: c.active }} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-muted">Todavía no tenés categorías.</p>}
      </Panel>
    </div>
  );
}
