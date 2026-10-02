import type { Metadata } from "next";
import { CatalogPage, type SearchParams } from "@/components/store/catalog-page";
import { getStoreBySlug, getStoreOrigin } from "@/lib/store/resolve";
import { storeMetadata } from "@/lib/seo";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const store = await getStoreBySlug((await params).slug);
  if (!store) return { robots: { index: false } };
  const q = (await searchParams).q;
  const meta = storeMetadata(store, await getStoreOrigin(store), { path: "/productos", title: "Todos los productos" });
  // Search and filter results are not indexed; the canonical points to the full catalog.
  return Object.keys(await searchParams).length || q ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  return <CatalogPage slug={(await params).slug} search={await searchParams} />;
}
