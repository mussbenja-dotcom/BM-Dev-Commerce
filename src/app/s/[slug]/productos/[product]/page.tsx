import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreBySlug, getStoreBase, getStoreOrigin } from "@/lib/store/resolve";
import { getProductBySlug, getRelatedProducts } from "@/lib/services/catalog";
import { ProductDetail } from "@/components/store/product-detail";
import { ProductCard } from "@/components/store/product-card";

export default async function ProductPage({ params }: { params: Promise<{ slug: string; product: string }> }) {
  const { slug, product } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  const p = await getProductBySlug(store.id, product);
  if (!p) notFound();
  const [base, origin, related] = await Promise.all([getStoreBase(slug), getStoreOrigin(store), getRelatedProducts(store.id, p.id, p.categoryId)]);
  return <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8"><nav className="mb-8 text-xs text-muted" aria-label="Ubicación"><Link href={base || "/"}>Inicio</Link> / <Link href={`${base}/productos`}>Productos</Link> / {p.name}</nav><ProductDetail product={{ name: p.name, slug: p.slug, description: p.description ?? "", price: p.price, compareAtPrice: p.compareAtPrice, option1Name: p.option1Name, option2Name: p.option2Name, images: p.images.map(({ url, alt }) => ({ url, alt })), variants: p.variants.map(({ id, option1, option2, stock, price }) => ({ id, option1, option2, stock, price })) }} productUrl={`${origin}/productos/${p.slug}`} /><section className="mt-20"><h2 className="mb-7 font-heading text-2xl">También te pueden gustar</h2><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{related.map((item) => <ProductCard key={item.id} product={item} base={base} square={store.theme?.cardStyle === "square"} />)}</div></section></div>;
}
