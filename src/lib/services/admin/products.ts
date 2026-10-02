import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";
import { AdminError, PAGE_SIZE } from "./common";
import type { Actor } from "./orders";
import { compareAtError, computeStockAdjustment, type StockAdjustMode } from "./product-rules";

export type ProductInput = {
  name: string;
  slug: string | null;
  description: string;
  categoryId: string | null;
  brand: string | null;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  option1Name: string | null;
  option2Name: string | null;
  active: boolean;
  featured: boolean;
  isNew: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  images: string[];
};

export type VariantInput = {
  sku: string;
  option1: string | null;
  option2: string | null;
  colorHex: string | null;
  price: number | null;
  lowStockAlert: number;
  active: boolean;
};

export type CategoryInput = { name: string; description: string | null; imageUrl: string | null; position: number; active: boolean };

const isUniqueError = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

// ---------------------------------------------------------------- queries

export type ProductFilters = { q?: string; categoryId?: string; status?: "active" | "inactive" | "low"; page: number };

export async function listAdminProducts(storeId: string, f: ProductFilters) {
  const where: Prisma.ProductWhereInput = { storeId };
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.status === "active") where.active = true;
  if (f.status === "inactive") where.active = false;
  if (f.status === "low") where.variants = { some: { active: true, stock: { lte: db.productVariant.fields.lowStockAlert } } };
  const q = f.q?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
    ];
  }
  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, sku: true, price: true, compareAtPrice: true, active: true, featured: true,
        category: { select: { name: true } },
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        variants: { select: { stock: true, lowStockAlert: true, active: true } },
      },
    }),
  ]);
  return {
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map(({ variants, images, ...p }) => {
      const live = variants.filter((v) => v.active);
      return {
        ...p,
        image: images[0]?.url ?? null,
        variantCount: variants.length,
        stock: live.reduce((sum, v) => sum + v.stock, 0),
        lowStock: live.some((v) => v.stock <= v.lowStockAlert),
      };
    }),
  };
}

export async function listCategories(storeId: string) {
  return db.category.findMany({
    where: { storeId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, description: true, imageUrl: true, position: true, active: true, _count: { select: { products: true } } },
  });
}

export async function getAdminProduct(storeId: string, productId: string) {
  return db.product.findFirst({
    where: { id: productId, storeId },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
  });
}

export async function getStockHistory(storeId: string, productId: string, take = 30) {
  return db.stockMovement.findMany({
    where: { storeId, variant: { productId, storeId } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, delta: true, stockAfter: true, reason: true, note: true, orderId: true, createdAt: true,
      variant: { select: { sku: true, option1: true, option2: true } },
    },
  });
}

// ---------------------------------------------------------------- products

async function assertCategory(tx: Prisma.TransactionClient, storeId: string, categoryId: string | null) {
  if (!categoryId) return;
  const found = await tx.category.findFirst({ where: { id: categoryId, storeId }, select: { id: true } });
  if (!found) throw new AdminError("Elegí una categoría de tu tienda.", { categoryId: "Elegí una categoría de tu tienda." });
}

async function uniqueSlug(tx: Prisma.TransactionClient, storeId: string, input: ProductInput, excludeId?: string): Promise<string> {
  const base = slugify(input.slug ?? input.name);
  if (!base) throw new AdminError("Revisá la dirección del producto.", { slug: "Usá letras o números." });
  const taken = async (slug: string) => !!(await tx.product.findFirst({ where: { storeId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } }));
  if (!(await taken(base))) return base;
  // An explicit slug is the merchant's choice: report it. A derived one gets a suffix.
  if (input.slug) throw new AdminError("Ya tenés otro producto con esa dirección.", { slug: "Ya está en uso en tu tienda." });
  for (let i = 2; i < 50; i++) if (!(await taken(`${base.slice(0, 74)}-${i}`))) return `${base.slice(0, 74)}-${i}`;
  throw new AdminError("Ya tenés muchos productos con ese nombre. Elegí una dirección distinta.", { slug: "Elegí una dirección distinta." });
}

function productData(input: ProductInput) {
  const err = compareAtError(input.price, input.compareAtPrice);
  if (err) throw new AdminError(err, { compareAtPrice: err });
  return {
    name: input.name, description: input.description, categoryId: input.categoryId, brand: input.brand, sku: input.sku,
    price: input.price, compareAtPrice: input.compareAtPrice, option1Name: input.option1Name, option2Name: input.option2Name,
    active: input.active, featured: input.featured, isNew: input.isNew, seoTitle: input.seoTitle, seoDescription: input.seoDescription,
  };
}

const imageRows = (storeId: string, productId: string, name: string, urls: string[]) =>
  urls.map((url, position) => ({ storeId, productId, url, alt: name, position }));

export async function createProduct(actor: Actor, input: ProductInput, initialStock: number) {
  try {
    return await db.$transaction(async (tx) => {
      await assertCategory(tx, actor.storeId, input.categoryId);
      const skuTaken = await tx.productVariant.findFirst({ where: { storeId: actor.storeId, sku: input.sku }, select: { id: true } });
      if (skuTaken) throw new AdminError("Ese SKU ya existe en tu tienda.", { sku: "Ya está en uso." });
      const slug = await uniqueSlug(tx, actor.storeId, input);
      const product = await tx.product.create({ data: { ...productData(input), slug, storeId: actor.storeId }, select: { id: true } });
      if (input.images.length) await tx.productImage.createMany({ data: imageRows(actor.storeId, product.id, input.name, input.images) });
      // Every product is sold through at least one variant; extra ones are added later.
      const variant = await tx.productVariant.create({ data: { storeId: actor.storeId, productId: product.id, sku: input.sku, stock: initialStock }, select: { id: true } });
      if (initialStock > 0) {
        await tx.stockMovement.create({ data: { storeId: actor.storeId, variantId: variant.id, delta: initialStock, stockAfter: initialStock, reason: "INITIAL", userId: actor.userId } });
      }
      return product;
    });
  } catch (err) {
    if (isUniqueError(err)) throw new AdminError("Ese SKU o esa dirección ya existen en tu tienda.", { sku: "Revisá que no esté repetido." });
    throw err;
  }
}

export async function updateProduct(actor: Actor, productId: string, input: ProductInput) {
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.product.findFirst({ where: { id: productId, storeId: actor.storeId }, select: { id: true } });
      if (!current) throw new AdminError("No encontramos el producto.");
      await assertCategory(tx, actor.storeId, input.categoryId);
      const slug = await uniqueSlug(tx, actor.storeId, input, productId);
      await tx.product.update({ where: { id: productId }, data: { ...productData(input), slug } });
      await tx.productImage.deleteMany({ where: { productId, storeId: actor.storeId } });
      if (input.images.length) await tx.productImage.createMany({ data: imageRows(actor.storeId, productId, input.name, input.images) });
      return { id: productId, slug };
    });
  } catch (err) {
    if (isUniqueError(err)) throw new AdminError("Ese SKU o esa dirección ya existen en tu tienda.", { sku: "Revisá que no esté repetido." });
    throw err;
  }
}

/** Products are archived, never deleted: past orders keep pointing at them. */
export async function setProductActive(actor: Actor, productId: string, active: boolean) {
  const r = await db.product.updateMany({ where: { id: productId, storeId: actor.storeId }, data: { active } });
  if (!r.count) throw new AdminError("No encontramos el producto.");
}

// ---------------------------------------------------------------- variants

export async function saveVariant(actor: Actor, productId: string, variantId: string | null, input: VariantInput, initialStock = 0) {
  try {
    return await db.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, storeId: actor.storeId }, select: { id: true, sku: true } });
      if (!product) throw new AdminError("No encontramos el producto.");
      const skuTaken = await tx.productVariant.findFirst({
        where: { storeId: actor.storeId, sku: input.sku, ...(variantId ? { id: { not: variantId } } : {}) },
        select: { id: true },
      });
      if (skuTaken) throw new AdminError("Ese SKU ya existe en tu tienda.", { sku: "Ya está en uso." });
      const sameOptions = await tx.productVariant.findFirst({
        where: { productId, storeId: actor.storeId, option1: input.option1, option2: input.option2, ...(variantId ? { id: { not: variantId } } : {}) },
        select: { id: true },
      });
      if (sameOptions) throw new AdminError("Ya existe una variante con esas opciones.", { option1: "Combinación repetida." });

      if (variantId) {
        const r = await tx.productVariant.updateMany({ where: { id: variantId, productId, storeId: actor.storeId }, data: input });
        if (!r.count) throw new AdminError("No encontramos la variante.");
        return { id: variantId };
      }
      const position = await tx.productVariant.count({ where: { productId, storeId: actor.storeId } });
      const variant = await tx.productVariant.create({ data: { ...input, storeId: actor.storeId, productId, stock: initialStock, position }, select: { id: true } });
      if (initialStock > 0) {
        await tx.stockMovement.create({ data: { storeId: actor.storeId, variantId: variant.id, delta: initialStock, stockAfter: initialStock, reason: "INITIAL", userId: actor.userId } });
      }
      return variant;
    });
  } catch (err) {
    if (isUniqueError(err)) throw new AdminError("Ese SKU ya existe en tu tienda.", { sku: "Ya está en uso." });
    throw err;
  }
}

/**
 * Manual stock change with its movement. The variant row is locked so a
 * concurrent checkout (conditional decrement) or another adjustment waits and
 * the recorded delta/stockAfter always match what happened.
 */
export async function adjustStock(actor: Actor, variantId: string, mode: StockAdjustMode, quantity: number, note: string | null) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; stock: number; productId: string }[]>`
      SELECT id, stock, "productId" FROM "ProductVariant" WHERE id = ${variantId} AND "storeId" = ${actor.storeId} FOR UPDATE`;
    const variant = rows[0];
    if (!variant) throw new AdminError("No encontramos la variante.");
    const result = computeStockAdjustment(variant.stock, mode, quantity);
    if ("error" in result) throw new AdminError(result.error, { quantity: result.error });
    await tx.productVariant.update({ where: { id: variant.id }, data: { stock: result.next } });
    await tx.stockMovement.create({
      data: { storeId: actor.storeId, variantId: variant.id, delta: result.delta, stockAfter: result.next, reason: "ADJUSTMENT", note, userId: actor.userId },
    });
    return { productId: variant.productId, before: variant.stock, after: result.next, delta: result.delta };
  });
}

// ---------------------------------------------------------------- categories

export async function saveCategory(actor: Actor, categoryId: string | null, input: CategoryInput) {
  const slug = slugify(input.name);
  if (!slug) throw new AdminError("Usá letras o números en el nombre.", { name: "Usá letras o números." });
  const taken = await db.category.findFirst({ where: { storeId: actor.storeId, slug, ...(categoryId ? { id: { not: categoryId } } : {}) }, select: { id: true } });
  if (taken) throw new AdminError("Ya tenés una categoría con ese nombre.", { name: "Ya existe." });
  try {
    if (categoryId) {
      const r = await db.category.updateMany({ where: { id: categoryId, storeId: actor.storeId }, data: { ...input, slug } });
      if (!r.count) throw new AdminError("No encontramos la categoría.");
      return { id: categoryId };
    }
    return await db.category.create({ data: { ...input, slug, storeId: actor.storeId }, select: { id: true } });
  } catch (err) {
    if (isUniqueError(err)) throw new AdminError("Ya tenés una categoría con ese nombre.", { name: "Ya existe." });
    throw err;
  }
}
