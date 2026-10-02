import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/** Fields every product card needs. One query, no N+1. */
export const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  compareAtPrice: true,
  isNew: true,
  featured: true,
  brand: true,
  option1Name: true,
  option2Name: true,
  images: { orderBy: { position: "asc" }, take: 2, select: { url: true, alt: true } },
  variants: {
    where: { active: true },
    orderBy: { position: "asc" },
    select: { id: true, option1: true, option2: true, colorHex: true, stock: true, price: true },
  },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export const SORT_OPTIONS = {
  relevancia: "Destacados",
  nuevos: "Más nuevos",
  "precio-asc": "Menor precio",
  "precio-desc": "Mayor precio",
  vendidos: "Más vendidos",
  ofertas: "Ofertas primero",
} as const;
export type SortKey = keyof typeof SORT_OPTIONS;

export type CatalogFilters = {
  q?: string;
  category?: string;
  sizes?: string[];
  colors?: string[];
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  sort?: SortKey;
  page?: number;
};

export const PAGE_SIZE = 12;

function buildWhere(storeId: string, f: CatalogFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ storeId, active: true }];
  if (f.q) {
    const q = f.q.trim().slice(0, 80);
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.category) and.push({ category: { slug: f.category, storeId } });
  if (f.brands?.length) and.push({ brand: { in: f.brands } });
  if (f.minPrice !== undefined) and.push({ price: { gte: f.minPrice } });
  if (f.maxPrice !== undefined) and.push({ price: { lte: f.maxPrice } });
  if (f.onSale) and.push({ compareAtPrice: { not: null } });
  const variantFilter: Prisma.ProductVariantWhereInput = { active: true };
  let needsVariant = false;
  if (f.sizes?.length) {
    variantFilter.option1 = { in: f.sizes };
    needsVariant = true;
  }
  if (f.colors?.length) {
    variantFilter.option2 = { in: f.colors };
    needsVariant = true;
  }
  if (f.inStock) {
    variantFilter.stock = { gt: 0 };
    needsVariant = true;
  }
  if (needsVariant) and.push({ variants: { some: variantFilter } });
  return { AND: and };
}

function buildOrder(sort: SortKey | undefined): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "nuevos":
      return [{ isNew: "desc" }, { createdAt: "desc" }];
    case "precio-asc":
      return [{ price: "asc" }];
    case "precio-desc":
      return [{ price: "desc" }];
    case "vendidos":
      return [{ soldCount: "desc" }];
    case "ofertas":
      // Products with a previous price (on sale) first, then the most sold.
      return [{ compareAtPrice: { sort: "desc", nulls: "last" } }, { soldCount: "desc" }];
    default:
      return [{ featured: "desc" }, { soldCount: "desc" }, { createdAt: "desc" }];
  }
}

export async function listProducts(storeId: string, f: CatalogFilters) {
  const page = Math.max(1, Math.min(200, f.page ?? 1));
  const where = buildWhere(storeId, f);
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: buildOrder(f.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: productCardSelect,
    }),
    db.product.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Facet values for the filter UI (scoped to category if given). */
export async function getFacets(storeId: string, categorySlug?: string) {
  const productWhere: Prisma.ProductWhereInput = {
    storeId,
    active: true,
    ...(categorySlug ? { category: { slug: categorySlug, storeId } } : {}),
  };
  const [variants, priceAgg, brands] = await Promise.all([
    db.productVariant.findMany({
      where: { storeId, active: true, product: productWhere },
      select: { option1: true, option2: true, colorHex: true },
      distinct: ["option1", "option2"],
    }),
    db.product.aggregate({ where: productWhere, _min: { price: true }, _max: { price: true } }),
    db.product.findMany({ where: { ...productWhere, brand: { not: null } }, select: { brand: true }, distinct: ["brand"] }),
  ]);
  const sizes = sortSizes([...new Set(variants.map((v) => v.option1).filter(Boolean) as string[])]);
  const colorMap = new Map<string, string | null>();
  for (const v of variants) if (v.option2 && !colorMap.has(v.option2)) colorMap.set(v.option2, v.colorHex);
  return {
    sizes,
    colors: [...colorMap].map(([name, hex]) => ({ name, hex })),
    brands: brands.map((b) => b.brand!).sort(),
    minPrice: priceAgg._min.price ?? 0,
    maxPrice: priceAgg._max.price ?? 0,
  };
}

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "U", "ÚNICO"];
export function sortSizes(sizes: string[]) {
  return sizes.sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, "es");
  });
}

export const getProductBySlug = cache(async (storeId: string, slug: string) => {
  return db.product.findFirst({
    where: { storeId, slug, active: true },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { where: { active: true }, orderBy: { position: "asc" } },
      category: true,
    },
  });
});

export async function getRelatedProducts(storeId: string, productId: string, categoryId: string | null, take = 4) {
  const sameCategory = categoryId
    ? await db.product.findMany({
        where: { storeId, active: true, categoryId, id: { not: productId } },
        orderBy: [{ soldCount: "desc" }],
        take,
        select: productCardSelect,
      })
    : [];
  if (sameCategory.length >= take) return sameCategory;
  const filler = await db.product.findMany({
    where: { storeId, active: true, id: { notIn: [productId, ...sameCategory.map((p) => p.id)] } },
    orderBy: [{ featured: "desc" }, { soldCount: "desc" }],
    take: take - sameCategory.length,
    select: productCardSelect,
  });
  return [...sameCategory, ...filler];
}

export async function getHomeData(storeId: string) {
  const base = { storeId, active: true };
  const [featured, newest, offers, bestsellers, heroBanners, promoBanners] = await Promise.all([
    db.product.findMany({ where: { ...base, featured: true }, take: 8, orderBy: { soldCount: "desc" }, select: productCardSelect }),
    db.product.findMany({ where: { ...base, isNew: true }, take: 8, orderBy: { createdAt: "desc" }, select: productCardSelect }),
    db.product.findMany({ where: { ...base, compareAtPrice: { not: null } }, take: 8, orderBy: { soldCount: "desc" }, select: productCardSelect }),
    db.product.findMany({ where: base, take: 8, orderBy: { soldCount: "desc" }, select: productCardSelect }),
    db.banner.findMany({ where: { storeId, placement: "hero", active: true }, orderBy: { position: "asc" } }),
    db.banner.findMany({ where: { storeId, placement: "promo", active: true }, orderBy: { position: "asc" }, take: 2 }),
  ]);
  return { featured, newest, offers, bestsellers, heroBanners, promoBanners };
}

export async function getSearchSuggestions(storeId: string, q: string) {
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  return db.product.findMany({
    where: {
      storeId,
      active: true,
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { category: { name: { contains: term, mode: "insensitive" } } },
      ],
    },
    take: 6,
    orderBy: { soldCount: "desc" },
    select: { name: true, slug: true, price: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } },
  });
}
