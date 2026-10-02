import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import type { Actor } from "@/lib/services/admin/orders";
import { adjustStock, createProduct, duplicateProduct, getAdminProduct, listStock, recentMovements, saveVariant, type ProductInput } from "@/lib/services/admin/products";
import { listBanners, saveBanner, type BannerInput } from "@/lib/services/admin/banners";
import { updateTheme, type ThemeInput } from "@/lib/services/admin/settings";
import { getDashboard } from "@/lib/services/admin/orders";
import { TEMPLATES } from "@/lib/templates";

const stores: string[] = [];
async function actor(label: string): Promise<Actor> {
  const store = await db.store.create({
    data: {
      slug: `qa-extras-${label}-${randomUUID()}`, name: label, industry: "test", template: "fashion", status: "ACTIVE",
      settings: { create: {} }, theme: { create: { ...TEMPLATES.fashion.theme, template: "fashion" } },
    },
  });
  stores.push(store.id);
  return { storeId: store.id, userId: "qa" };
}
const product = (extra: Partial<ProductInput> = {}): ProductInput => ({
  name: "Campera", slug: null, description: "x", categoryId: null, brand: null, sku: "CAMP", price: 50000, compareAtPrice: 60000,
  option1Name: "Talle", option2Name: null, active: true, featured: true, isNew: false, seoTitle: null, seoDescription: null, images: ["https://images.unsplash.com/a"], ...extra,
});
const banner = (extra: Partial<BannerInput> = {}): BannerInput => ({
  placement: "promo", eyebrow: null, title: "Liquidación", subtitle: null, ctaLabel: "Ver", ctaHref: "/productos?oferta=1",
  imageUrl: "https://images.unsplash.com/b", mobileImageUrl: null, position: 0, active: true, ...extra,
});
const theme = (extra: Partial<ThemeInput> = {}): ThemeInput => ({
  template: "fashion", applyTemplate: false, primaryColor: "#123456", accentColor: "#aa5500", backgroundColor: "#ffffff", textColor: "#111111",
  headingFont: "jost", bodyFont: "dm-sans", radius: "md", heroLayout: "split", cardStyle: "square", headingCase: "normal", homeSections: ["hero", "featured"], ...extra,
});

afterAll(async () => {
  await db.store.deleteMany({ where: { id: { in: stores } } });
});

describe("admin extras", () => {
  it("duplicates a product hidden, with new SKUs and no stock, only inside the store", async () => {
    const [a, b] = [await actor("dup-a"), await actor("dup-b")];
    const p = await createProduct(a, product(), 7);
    await saveVariant(a, p.id, null, { sku: "CAMP-L", option1: "L", option2: null, colorHex: null, price: null, lowStockAlert: 2, active: true }, 3);
    const copy = await duplicateProduct(a, p.id);
    const dup = await getAdminProduct(a.storeId, copy.id);
    expect(dup).toMatchObject({ name: "Campera (copia)", slug: "campera-copia", sku: "CAMP-COPIA", active: false, featured: false, compareAtPrice: 60000 });
    expect(dup!.variants.map((v) => [v.sku, v.stock])).toEqual([["CAMP-COPIA", 0], ["CAMP-L-COPIA", 0]]);
    expect(dup!.images).toHaveLength(1);
    expect((await duplicateProduct(a, p.id)).id).not.toBe(copy.id);
    await expect(duplicateProduct(b, p.id)).rejects.toThrow("No encontramos el producto.");
  });

  it("lists stock and movements per store", async () => {
    const [a, b] = [await actor("stk-a"), await actor("stk-b")];
    const p = await createProduct(a, product(), 1);
    const variantId = (await getAdminProduct(a.storeId, p.id))!.variants[0].id;
    await adjustStock(a, variantId, "remove", 1, "Rotura");
    expect((await listStock(a.storeId, { filter: "agotado", page: 1 })).rows.map((r) => r.id)).toEqual([variantId]);
    expect((await listStock(b.storeId, { filter: undefined, page: 1 })).total).toBe(0);
    expect((await recentMovements(a.storeId)).map((m) => [m.reason, m.note])).toEqual([["ADJUSTMENT", "Rotura"], ["INITIAL", null]]);
    expect(await recentMovements(b.storeId)).toEqual([]);
  });

  it("saves banners with store links only, isolated per store", async () => {
    const [a, b] = [await actor("ban-a"), await actor("ban-b")];
    const created = await saveBanner(a, null, banner());
    await expect(saveBanner(a, null, banner({ ctaHref: "https://phishing.example" }))).rejects.toMatchObject({ fieldErrors: { ctaHref: expect.any(String) } });
    await expect(saveBanner(a, null, banner({ ctaHref: "//evil.example" }))).rejects.toThrow();
    await expect(saveBanner(b, created.id, banner({ title: "Robado" }))).rejects.toThrow("No encontramos el banner.");
    expect((await listBanners(a.storeId)).map((x) => x.title)).toEqual(["Liquidación"]);
    expect(await listBanners(b.storeId)).toEqual([]);
  });

  it("checks legibility, computes button text and can apply a template preset", async () => {
    const a = await actor("theme");
    await expect(updateTheme(a, theme({ textColor: "#eeeeee" }))).rejects.toMatchObject({ fieldErrors: { textColor: expect.any(String) } });
    await expect(updateTheme(a, theme({ homeSections: [] }))).rejects.toMatchObject({ fieldErrors: { homeSections: expect.any(String) } });
    await updateTheme(a, theme({ primaryColor: "#f2d16b", backgroundColor: "#1c1a17", textColor: "#ffffff" }));
    expect(await db.storeTheme.findUniqueOrThrow({ where: { storeId: a.storeId } })).toMatchObject({ primaryColor: "#f2d16b", primaryContrast: "#111111", heroLayout: "split", homeSections: ["hero", "featured"] });
    await updateTheme(a, theme({ template: "beauty", applyTemplate: true, textColor: "#eeeeee", homeSections: ["hero", "offers"] }));
    const t = await db.storeTheme.findUniqueOrThrow({ where: { storeId: a.storeId } });
    expect(t).toMatchObject({ template: "beauty", primaryColor: TEMPLATES.beauty.theme.primaryColor, headingFont: TEMPLATES.beauty.theme.headingFont, homeSections: ["hero", "offers"] });
    expect((await db.store.findUniqueOrThrow({ where: { id: a.storeId } })).template).toBe("beauty");
  });

  it("returns 30 days of sales and best sellers in the dashboard", async () => {
    const a = await actor("dash");
    const d = await getDashboard(a.storeId);
    expect(d.days).toHaveLength(30);
    expect(d.topProducts).toEqual([]);
  });
});
