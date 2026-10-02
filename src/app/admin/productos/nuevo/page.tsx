import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStoreSession } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/admin/products";
import { PageHeader } from "@/components/admin/order-badges";
import { ProductForm } from "@/components/admin/product-forms";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  const session = await requireStoreSession();
  const categories = await listCategories(session.storeId);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/productos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" aria-hidden /> Productos</Link>
      <PageHeader title="Nuevo producto" description="Después de crearlo vas a poder sumar variantes (talles, colores) y ajustar el stock." />
      <ProductForm
        categories={categories}
        product={{ name: "", slug: "", description: "", categoryId: "", brand: "", sku: "", price: "", compareAtPrice: "", option1Name: "", option2Name: "", active: true, featured: false, isNew: true, seoTitle: "", seoDescription: "", images: "" }}
      />
    </div>
  );
}
