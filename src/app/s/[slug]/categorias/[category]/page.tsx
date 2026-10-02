import type { Metadata } from "next";
import { CatalogPage, type SearchParams } from "@/components/store/catalog-page";
import { getStoreBySlug, getStoreOrigin } from "@/lib/store/resolve";
import { storeMetadata } from "@/lib/seo";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string; category: string }>; searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const { slug, category } = await params;
  const store = await getStoreBySlug(slug);
  const cat = store?.categories.find((c) => c.slug === category);
  if (!store || !cat) return { title: "Categoría no encontrada", robots: { index: false } };
  const meta = storeMetadata(store, await getStoreOrigin(store), { path: `/categorias/${cat.slug}`, title: cat.name, description: cat.description, image: cat.imageUrl });
  return Object.keys(await searchParams).length ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string; category: string }>; searchParams: Promise<SearchParams> }) {
  return <CatalogPage {...await params} search={await searchParams} />;
}
