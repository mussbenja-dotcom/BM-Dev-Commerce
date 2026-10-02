import { CatalogPage, type SearchParams } from "@/components/store/catalog-page";
export default async function ProductsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  return <CatalogPage slug={(await params).slug} search={await searchParams} />;
}
