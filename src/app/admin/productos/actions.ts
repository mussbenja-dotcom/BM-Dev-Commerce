"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStoreSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { AdminError, IMAGE_URL_MESSAGE, isImageUrl, ok, revalidateStore, run, zf } from "@/lib/services/admin/common";
import type { ActionResult, ActionState } from "@/lib/services/admin/types";
import type { Actor } from "@/lib/services/admin/orders";
import { MAX_STOCK, normalizeSku } from "@/lib/services/admin/product-rules";
import { adjustStock, createProduct, duplicateProduct, saveCategory, saveVariant, setProductActive, updateProduct } from "@/lib/services/admin/products";

const id = z.string().trim().min(1).max(40);
const optionalId = z.string().trim().max(40).transform((v) => v || null);
const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

async function actor(): Promise<Actor> {
  const session = await requireStoreSession();
  return { storeId: session.storeId, userId: session.userId };
}

async function done(a: Actor, action: string, entity: string, entityId: string, message: string, meta?: Record<string, unknown>): Promise<ActionResult> {
  await audit({ action, storeId: a.storeId, userId: a.userId, entity, entityId, meta });
  await revalidateStore(a.storeId, { storefront: true });
  return ok(message, { id: entityId });
}

const sku = z
  .string()
  .transform(normalizeSku)
  .pipe(z.string().min(1, "Ingresá un SKU (código interno)."));

const productSchema = z.object({
  name: zf.required(120, "Ingresá el nombre del producto."),
  slug: zf.optional(80),
  description: z.string().trim().max(5000, "Máximo 5000 caracteres."),
  categoryId: optionalId,
  brand: zf.optional(60),
  sku,
  price: zf.money("Ingresá el precio de venta."),
  compareAtPrice: zf.optionalMoney("Ingresá un precio anterior válido."),
  option1Name: zf.optional(30),
  option2Name: zf.optional(30),
  active: zf.bool,
  featured: zf.bool,
  isNew: zf.bool,
  seoTitle: zf.optional(70),
  seoDescription: zf.optional(160),
  images: z
    .string()
    .transform((v) => v.split(/\s*\n\s*/).map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(500).refine(isImageUrl, IMAGE_URL_MESSAGE)).max(8, "Hasta 8 imágenes.")),
});
const PRODUCT_KEYS = Object.keys(productSchema.shape);

function readProduct(fd: FormData) {
  return productSchema.parse(Object.fromEntries(PRODUCT_KEYS.map((k) => [k, str(fd, k)])));
}

export async function saveProductAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  const productId = str(fd, "productId").slice(0, 40);
  const result = await run(async () => {
    const input = readProduct(fd);
    if (productId) {
      await updateProduct(a, productId, input);
      return done(a, "product.update", "product", productId, "Producto guardado.");
    }
    const initialStock = zf.int(0, MAX_STOCK, "Ingresá un stock inicial entre 0 y 1.000.000.").parse(str(fd, "initialStock") || "0");
    const created = await createProduct(a, input, initialStock);
    return done(a, "product.create", "product", created.id, "Producto creado.", { initialStock });
  });
  if (result.ok && !productId && result.id) redirect(`/admin/productos/${result.id}?creado=1`);
  return result;
}

const activeSchema = z.object({ productId: id, active: z.enum(["true", "false"]).transform((v) => v === "true") });

export async function setProductActiveAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const input = activeSchema.parse({ productId: str(fd, "productId"), active: str(fd, "active") });
    await setProductActive(a, input.productId, input.active);
    return done(a, input.active ? "product.activate" : "product.archive", "product", input.productId, input.active ? "Producto visible en la tienda." : "Producto oculto de la tienda.");
  });
}

const colorHex = z
  .string()
  .trim()
  .refine((v) => v === "" || /^#[0-9a-fA-F]{6}$/.test(v), "Usá un color como #1a2b3c.")
  .transform((v) => (v ? v.toLowerCase() : null));

const variantSchema = z.object({
  sku,
  option1: zf.optional(40),
  option2: zf.optional(40),
  colorHex,
  price: zf.optionalMoney("Ingresá un precio válido o dejalo vacío."),
  lowStockAlert: zf.int(0, 10_000, "Ingresá un número entre 0 y 10.000."),
  active: zf.bool,
});

export async function saveVariantAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const productId = id.parse(str(fd, "productId"));
    const variantId = optionalId.parse(str(fd, "variantId"));
    const input = variantSchema.parse({
      sku: str(fd, "sku"), option1: str(fd, "option1"), option2: str(fd, "option2"), colorHex: str(fd, "colorHex"),
      price: str(fd, "price"), lowStockAlert: str(fd, "lowStockAlert") || "3", active: str(fd, "active"),
    });
    const initialStock = variantId ? 0 : zf.int(0, MAX_STOCK, "Ingresá un stock inicial entre 0 y 1.000.000.").parse(str(fd, "initialStock") || "0");
    const r = await saveVariant(a, productId, variantId, input, initialStock);
    return done(a, variantId ? "variant.update" : "variant.create", "variant", r.id, variantId ? "Variante guardada." : "Variante agregada.", { productId });
  });
}

const stockSchema = z.object({
  variantId: id,
  mode: z.enum(["set", "add", "remove"], { message: "Elegí cómo ajustar el stock." }),
  quantity: zf.int(0, MAX_STOCK, "Ingresá una cantidad entre 0 y 1.000.000."),
  note: zf.optional(200),
});

export async function adjustStockAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const input = stockSchema.parse({ variantId: str(fd, "variantId"), mode: str(fd, "mode"), quantity: str(fd, "quantity"), note: str(fd, "note") });
    const r = await adjustStock(a, input.variantId, input.mode, input.quantity, input.note);
    return done(a, "stock.adjust", "variant", input.variantId, `Stock actualizado: ${r.before} → ${r.after}.`, { delta: r.delta, productId: r.productId });
  });
}

const categorySchema = z.object({
  name: zf.required(60, "Ingresá el nombre de la categoría."),
  description: zf.optional(300),
  imageUrl: zf.optionalUrl(),
  position: zf.int(0, 999, "Usá un número entre 0 y 999."),
  active: zf.bool,
});

export async function saveCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const categoryId = optionalId.parse(str(fd, "categoryId"));
    const input = categorySchema.parse({
      name: str(fd, "name"), description: str(fd, "description"), imageUrl: str(fd, "imageUrl"), position: str(fd, "position") || "0", active: str(fd, "active"),
    });
    const r = await saveCategory(a, categoryId, input);
    if (!r) throw new AdminError("No pudimos guardar la categoría.");
    return done(a, categoryId ? "category.update" : "category.create", "category", r.id, categoryId ? "Categoría guardada." : "Categoría creada.");
  });
}

export async function duplicateProductAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  const result = await run(async () => {
    const productId = id.parse(str(fd, "productId"));
    const copy = await duplicateProduct(a, productId);
    return done(a, "product.duplicate", "product", copy.id, "Copia creada.", { from: productId });
  });
  if (result.ok && result.id) redirect(`/admin/productos/${result.id}?copia=1`);
  return result;
}
