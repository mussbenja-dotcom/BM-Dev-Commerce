import Image from "next/image";
import Link from "next/link";
import { formatPrice, discountPercent } from "@/lib/money";
import type { ProductCardData } from "@/lib/services/catalog";

export function ProductCard({ product: p, base, square = false }: { product: ProductCardData; base: string; square?: boolean }) {
  const available = p.variants.some((v) => v.stock > 0);
  const price = p.variants.length ? Math.min(...p.variants.map((v) => v.price ?? p.price)) : p.price;
  const discount = discountPercent(price, p.compareAtPrice);
  return <Link href={`${base}/productos/${p.slug}`} className="group block min-w-0" data-testid="product-card">
    <div className={`relative overflow-hidden rounded-theme bg-surface ${square ? "aspect-square" : "aspect-[3/4]"}`}>
      {p.images[0] && <Image src={p.images[0].url} alt={p.images[0].alt ?? p.name} fill quality={80} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
      <div className="absolute left-3 top-3 flex gap-2 text-xs">{!available ? <span className="bg-bg px-2 py-1">Agotado</span> : discount > 0 ? <span className="bg-primary px-2 py-1 text-on-primary">−{discount}%</span> : p.isNew ? <span className="bg-bg px-2 py-1">Nuevo</span> : null}</div>
    </div>
    <div className="space-y-1 py-3"><p className="text-xs text-muted">{p.category?.name}</p><h3 className="text-sm font-medium sm:text-base">{p.name}</h3><p className="text-sm">{price !== p.price ? "Desde " : ""}{formatPrice(price)} {discount > 0 && <del className="ml-2 text-xs text-muted">{formatPrice(p.compareAtPrice!)}</del>}</p></div>
  </Link>;
}
