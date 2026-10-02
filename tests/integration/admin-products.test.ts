import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import type { Actor } from "@/lib/services/admin/orders";
import { adjustStock, createProduct, getAdminProduct, getStockHistory, listAdminProducts, saveCategory, saveVariant, setProductActive, updateProduct, type ProductInput } from "@/lib/services/admin/products";

const stores: string[] = [];

async function actor(label: string): Promise<Actor> {
  const store = await db.store.create({
    data: { slug: `qa-products-${label}-${randomUUID()}`, name: `Productos ${label}`, industry: "test", template: "minimal", status: "ACTIVE", settings: { create: {} } },
  });
  stores.push(store.id);
  const user = await db.user.create({ data: { email: `qa-${randomUUID()}@example.invalid`, name: "QA", passwordHash: "x", role: "STORE_OWNER", storeId: store.id } });
  return { storeId: store.id, userId: user.id };
}

const input = (extra: Partial<ProductInput> = {}): ProductInput => ({
  name: "Remera Lisa", slug: null, description: "Algodón", categoryId: null, brand: null, sku: "REM-LISA", price: 10000, compareAtPrice: null,
  option1Name: "Talle", option2Name: null, active: true, featured: false, isNew: false, seoTitle: null, seoDescription: null, images: ["https://images.example.com/a.jpg"],
  ...extra,
});

afterAll(async () => {
  await db.store.deleteMany({ where: { id: { in: stores } } });
});

describe("admin products", () => {
  it("creates a product with its first variant and an initial stock movement", async () => {
    const a = await actor("create");
    const p = await createProduct(a, input(), 12);
    const product = await getAdminProduct(a.storeId, p.id);
    expect(product).toMatchObject({ slug: "remera-lisa", variants: [{ sku: "REM-LISA", stock: 12 }], images: [{ url: "https://images.example.com/a.jpg", position: 0 }] });
    expect(await getStockHistory(a.storeId, p.id)).toMatchObject([{ reason: "INITIAL", delta: 12, stockAfter: 12 }]);

    // Same name: derived slug gets a suffix; repeated SKU is reported on the field.
    const second = await createProduct(a, input({ sku: "REM-LISA-2" }), 0);
    expect((await getAdminProduct(a.storeId, second.id))?.slug).toBe("remera-lisa-2");
    await expect(createProduct(a, input({ name: "Otra" }), 0)).rejects.toMatchObject({ fieldErrors: { sku: "Ya está en uso." } });
    await expect(createProduct(a, input({ name: "Oferta", sku: "OF-1", compareAtPrice: 9000 }), 0)).rejects.toMatchObject({ fieldErrors: { compareAtPrice: expect.any(String) } });
  });

  it("keeps every store's catalog isolated", async () => {
    const [a, b] = [await actor("a"), await actor("b")];
    const p = await createProduct(a, input(), 5);
    const variantId = (await getAdminProduct(a.storeId, p.id))!.variants[0].id;
    const foreignCategory = await saveCategory(b, null, { name: "Ajena", description: null, imageUrl: null, position: 0, active: true });

    expect(await getAdminProduct(b.storeId, p.id)).toBeNull();
    expect((await listAdminProducts(b.storeId, { page: 1 })).total).toBe(0);
    await expect(updateProduct(b, p.id, input({ name: "Hackeado" }))).rejects.toThrow("No encontramos el producto.");
    await expect(setProductActive(b, p.id, false)).rejects.toThrow("No encontramos el producto.");
    await expect(saveVariant(b, p.id, null, { sku: "X", option1: "L", option2: null, colorHex: null, price: null, lowStockAlert: 3, active: true })).rejects.toThrow("No encontramos el producto.");
    await expect(saveVariant(b, p.id, variantId, { sku: "X", option1: "L", option2: null, colorHex: null, price: null, lowStockAlert: 3, active: true })).rejects.toThrow("No encontramos el producto.");
    await expect(adjustStock(b, variantId, "set", 99, null)).rejects.toThrow("No encontramos la variante.");
    await expect(updateProduct(a, p.id, input({ categoryId: foreignCategory.id }))).rejects.toThrow("Elegí una categoría de tu tienda.");
    await expect(getStockHistory(b.storeId, p.id)).resolves.toEqual([]);

    const after = await getAdminProduct(a.storeId, p.id);
    expect(after).toMatchObject({ name: "Remera Lisa", active: true, variants: [{ stock: 5, sku: "REM-LISA" }] });
    // The same SKU can exist in another store.
    await expect(createProduct(b, input(), 0)).resolves.toHaveProperty("id");
  });

  it("records each manual adjustment and never lets stock go negative", async () => {
    const a = await actor("stock");
    const p = await createProduct(a, input(), 5);
    const variant = await saveVariant(a, p.id, null, { sku: "REM-LISA-L", option1: "L", option2: null, colorHex: "#111111", price: null, lowStockAlert: 2, active: true }, 4);
    await expect(saveVariant(a, p.id, null, { sku: "REM-LISA-L2", option1: "L", option2: null, colorHex: null, price: null, lowStockAlert: 2, active: true })).rejects.toThrow("Ya existe una variante con esas opciones.");

    expect(await adjustStock(a, variant.id, "add", 6, "Llegó mercadería")).toMatchObject({ before: 4, after: 10, delta: 6 });
    expect(await adjustStock(a, variant.id, "set", 7, "Conteo")).toMatchObject({ after: 7, delta: -3 });
    await expect(adjustStock(a, variant.id, "remove", 8, null)).rejects.toThrow("No podés descontar más de lo que hay en stock (7).");

    // Two simultaneous removals of 5 from 7: exactly one succeeds.
    const results = await Promise.allSettled([adjustStock(a, variant.id, "remove", 5, null), adjustStock(a, variant.id, "remove", 5, null)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const final = await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(final.stock).toBe(2);

    const history = await getStockHistory(a.storeId, p.id);
    const forVariant = history.filter((m) => m.variant.sku === "REM-LISA-L");
    expect(forVariant.map((m) => [m.reason, m.delta, m.stockAfter])).toEqual([["ADJUSTMENT", -5, 2], ["ADJUSTMENT", -3, 7], ["ADJUSTMENT", 6, 10], ["INITIAL", 4, 4]]);
    expect(forVariant[0].note).toBeNull();
    expect((await listAdminProducts(a.storeId, { page: 1, status: "low" })).rows.map((r) => r.id)).toEqual([p.id]);
  });

  it("archives instead of deleting and filters by visibility", async () => {
    const a = await actor("archive");
    const p = await createProduct(a, input(), 1);
    await setProductActive(a, p.id, false);
    expect((await listAdminProducts(a.storeId, { page: 1, status: "inactive" })).total).toBe(1);
    expect((await listAdminProducts(a.storeId, { page: 1, status: "active" })).total).toBe(0);
    expect(await db.product.count({ where: { id: p.id } })).toBe(1);
  });
});
