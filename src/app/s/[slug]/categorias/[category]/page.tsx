import { CatalogPage, type SearchParams } from "@/components/store/catalog-page";
export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string; category: string }>; searchParams: Promise<SearchParams> }) {
  return <CatalogPage {...await params} search={await searchParams} />;
}
