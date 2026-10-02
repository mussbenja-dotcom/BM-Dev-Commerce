import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreBySlug, getStoreBase, getStoreOrigin } from "@/lib/store/resolve";
import { getProductBySlug, getRelatedProducts } from "@/lib/services/catalog";
import { ProductDetail } from "@/components/store/product-detail";
import { ProductCard } from "@/components/store/product-card";
import { JsonLd } from "@/components/store/json-ld";
import { storeMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; product: string }> }): Promise<Metadata> {
  const { slug, product } = await params;
  const store = await getStoreBySlug(slug);
  const p = store ? await getProductBySlug(store.id, product) : null;
  if (!store || !p) return { title: "Producto no encontrado", robots: { index: false } };
  return storeMetadata(store, await getStoreOrigin(store), { path: `/productos/${p.slug}`, title: p.seoTitle ?? p.name, description: p.seoDescription ?? p.description, image: p.images[0]?.url, type: "article" });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; product: string }> }) {
  const { slug, product } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  const p = await getProductBySlug(store.id, product);
  if (!p) notFound();
  const [base, origin, related] = await Promise.all([getStoreBase(slug), getStoreOrigin(store), getRelatedProducts(store.id, p.id, p.categoryId)]);
  const url = `${origin}/productos/${p.slug}`;
  const inStock = p.variants.some((v) => v.stock > 0);
  const prices = p.variants.map((v) => v.price ?? p.price);
  const structured = [
    {
      "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.description, sku: p.sku, url,
      image: p.images.map((i) => i.url),
      ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
      offers: {
        "@type": "AggregateOffer", priceCurrency: "ARS", lowPrice: Math.min(p.price, ...prices), highPrice: Math.max(p.price, ...prices), offerCount: p.variants.length || 1,
        availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url, seller: { "@type": "Organization", name: store.name },
      },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: store.name, item: origin },
        ...(p.category ? [{ "@type": "ListItem", position: 2, name: p.category.name, item: `${origin}/categorias/${p.category.slug}` }] : []),
        { "@type": "ListItem", position: p.category ? 3 : 2, name: p.name, item: url },
      ],
    },
  ];
  return <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8"><JsonLd data={structured} /><nav className="mb-8 text-xs text-muted" aria-label="Ubicación"><Link href={base || "/"}>Inicio</Link> / <Link href={`${base}/productos`}>Productos</Link> / {p.name}</nav><ProductDetail product={{ name: p.name, slug: p.slug, description: p.description ?? "", price: p.price, compareAtPrice: p.compareAtPrice, option1Name: p.option1Name, option2Name: p.option2Name, images: p.images.map(({ url, alt }) => ({ url, alt })), variants: p.variants.map(({ id, option1, option2, stock, price }) => ({ id, option1, option2, stock, price })) }} productUrl={`${origin}/productos/${p.slug}`} /><section className="mt-20"><h2 className="mb-7 font-heading text-2xl">También te pueden gustar</h2><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{related.map((item) => <ProductCard key={item.id} product={item} base={base} square={store.theme?.cardStyle === "square"} />)}</div></section></div>;
}
