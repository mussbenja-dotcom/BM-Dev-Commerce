import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Truck, CreditCard, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getStoreBySlug, getStoreBase, getStoreOrigin } from "@/lib/store/resolve";
import { storeMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/store/json-ld";
import { getHomeData, type ProductCardData } from "@/lib/services/catalog";
import { ProductCard } from "@/components/store/product-card";
import { buttonClasses } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const store = await getStoreBySlug((await params).slug);
  if (!store) return { title: "Tienda no encontrada", robots: { index: false } };
  return storeMetadata(store, await getStoreOrigin(store), { path: "" });
}

export default async function StoreHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store?.theme || !store.settings) notFound();
  const [data, base, origin] = await Promise.all([getHomeData(store.id), getStoreBase(slug), getStoreOrigin(store)]);
  const st = store.settings;
  const organization = {
    "@context": "https://schema.org", "@type": "Organization", name: store.name, url: origin,
    ...(st.logoUrl ? { logo: st.logoUrl } : {}),
    ...(st.email ? { email: st.email } : {}),
    sameAs: [st.instagram && `https://www.instagram.com/${st.instagram.replace(/^@/, "")}`, st.facebook && `https://www.facebook.com/${st.facebook}`, st.tiktok && `https://www.tiktok.com/@${st.tiktok.replace(/^@/, "")}`].filter(Boolean),
  };
  const sections = Array.isArray(store.theme.homeSections) ? store.theme.homeSections : ["hero", "featured"];
  const collections: Record<string, { title: string; products: ProductCardData[]; query: string }> = { featured: { title: "Nuestros elegidos", products: data.featured, query: "" }, new: { title: "Recién llegados", products: data.newest, query: "?orden=nuevos" }, offers: { title: "Especiales para vos", products: data.offers, query: "?oferta=1" }, bestsellers: { title: "Los más queridos", products: data.bestsellers, query: "?orden=vendidos" } };
  const href = (path: string | null) => `${base}${path?.startsWith("/") && !path.startsWith("//") ? path : "/productos"}`;
  const hero = data.heroBanners[0];
  return <><JsonLd data={organization} />{sections.map((section, index) => {
    const key = `${section}-${index}`;
    if (section === "hero") return hero ? <section key={key} className={`relative overflow-hidden bg-surface ${store.theme!.heroLayout === "full" ? "min-h-[65vh] text-white" : "grid lg:min-h-[560px] lg:grid-cols-2"}`}>
      <div className={store.theme!.heroLayout === "full" ? "absolute inset-0" : "relative order-last min-h-80 lg:order-none"}><Image src={hero.imageUrl} alt={hero.title} fill quality={80} preload sizes="(max-width: 1024px) 100vw, 70vw" className="object-cover" />{store.theme!.heroLayout === "full" && <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />}</div>
      <div className={`relative z-10 flex flex-col justify-center px-7 py-20 sm:px-16 ${store.theme!.heroLayout === "full" ? "mx-auto min-h-[65vh] max-w-7xl" : "lg:px-16"}`}><p className="mb-4 text-xs uppercase tracking-[0.25em]">{hero.eyebrow ?? store.settings!.tagline}</p><h1 className="max-w-xl font-heading text-4xl leading-tight sm:text-6xl">{hero.title}</h1><p className="mt-5 max-w-md text-base opacity-90">{hero.subtitle}</p><Link href={href(hero.ctaHref)} className={buttonClasses("primary", "lg", "mt-8 w-fit")}>{hero.ctaLabel ?? "Descubrir colección"} <span aria-hidden>↗</span></Link></div>
    </section> : <section key={key} className="bg-surface px-5 py-20 text-center"><h1 className="font-heading text-5xl">{store.name}</h1><p className="my-5">{store.settings!.tagline}</p><Link href={`${base}/productos`} className={buttonClasses()}>Ver productos</Link></section>;
    if (section === "categories") return <section key={key} className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><h2 className="mb-7 font-heading text-2xl sm:text-3xl">Encontrá tu próximo favorito</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{store.categories.map((c) => <Link href={`${base}/categorias/${c.slug}`} key={c.id} className="group relative aspect-[4/3] overflow-hidden rounded-theme bg-surface">{c.imageUrl && <Image src={c.imageUrl} alt={c.name} fill quality={80} sizes="(max-width: 640px) 50vw, 25vw" className="object-cover transition-transform group-hover:scale-105" />}<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-12 font-heading text-lg text-white">{c.name} ↗</span></Link>)}</div></section>;
    if (typeof section === "string" && collections[section]) { const c = collections[section]; return c.products.length ? <section key={key} className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><div className="mb-7 flex items-end justify-between gap-4"><h2 className="font-heading text-2xl sm:text-3xl">{c.title}</h2><Link className="shrink-0 text-sm underline underline-offset-4" href={`${base}/productos${c.query}`}>Ver todos ↗</Link></div><div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">{c.products.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} base={base} square={store.theme!.cardStyle === "square"} />)}</div></section> : null; }
    if (section === "promo") return <div key={key} className={`mx-auto grid max-w-7xl gap-5 px-5 py-10 lg:px-8 ${data.promoBanners.length > 1 ? "lg:grid-cols-2" : ""}`}>{data.promoBanners.map((banner) => <Link href={href(banner.ctaHref)} key={banner.id} className="relative flex min-h-80 items-end overflow-hidden rounded-theme bg-surface p-7 text-white"><Image src={banner.imageUrl} alt="" fill quality={80} sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" /><div className="relative"><p className="text-xs uppercase tracking-widest">{banner.eyebrow}</p><h2 className="my-3 font-heading text-3xl">{banner.title}</h2><p className="text-sm underline underline-offset-4">{banner.ctaLabel ?? "Ver más"} ↗</p></div></Link>)}</div>;
    if (section === "benefits") return <section key={key} className="my-10 border-y border-line bg-surface"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 text-center sm:grid-cols-3"><div><Truck className="mx-auto mb-3" /><h2 className="font-medium">A donde estés</h2><p className="mt-2 text-sm text-muted">{store.settings!.freeShippingThreshold ? `Envío gratis desde ${formatPrice(store.settings!.freeShippingThreshold)}` : "Consultá opciones de envío y retiro"}</p></div><div><CreditCard className="mx-auto mb-3" /><h2 className="font-medium">Elegí cómo pagar</h2><p className="mt-2 text-sm text-muted">{store.settings!.transferDiscountPct ? `${store.settings!.transferDiscountPct}% de descuento por transferencia` : "Medios de pago para vos"}</p></div><div><MessageCircle className="mx-auto mb-3" /><h2 className="font-medium">Te acompañamos</h2><p className="mt-2 text-sm text-muted">Atención personalizada en cada compra</p></div></div></section>;
    if (section === "instagram" && store.settings!.instagram) return <section key={key} className="px-5 py-12 text-center"><p className="mb-3 text-xs uppercase tracking-widest">Sigamos en contacto</p><a href={`https://www.instagram.com/${store.settings!.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="font-heading text-2xl underline underline-offset-8">@{store.settings!.instagram.replace(/^@/, "")}</a></section>;
    return null;
  })}</>;
}
