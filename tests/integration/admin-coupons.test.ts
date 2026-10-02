import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import type { Actor } from "@/lib/services/admin/orders";
import { listCoupons, saveCoupon, setCouponActive, type CouponInput } from "@/lib/services/admin/coupons";
import { buildQuote } from "@/lib/services/checkout";

const stores: string[] = [];

async function fixture(label: string) {
  const store = await db.store.create({
    data: { slug: `qa-coupons-${label}-${randomUUID()}`, name: `Cupones ${label}`, industry: "test", template: "minimal", status: "ACTIVE", settings: { create: {} } },
  });
  stores.push(store.id);
  const user = await db.user.create({ data: { email: `qa-${randomUUID()}@example.invalid`, name: "QA", passwordHash: "x", role: "STORE_OWNER", storeId: store.id } });
  const product = await db.product.create({
    data: { storeId: store.id, slug: "p", name: "Producto", description: "x", sku: `P-${label}`, price: 10000, variants: { create: { storeId: store.id, sku: `P-${label}-1`, stock: 10 } } },
    include: { variants: true },
  });
  return { actor: { storeId: store.id, userId: user.id } as Actor, variantId: product.variants[0].id };
}

const coupon = (extra: Partial<CouponInput> = {}): CouponInput => ({
  code: "VERANO10", description: null, type: "PERCENT", value: 10, minSubtotal: null, maxUses: null, startsAt: null, endsAt: null, active: true, ...extra,
});

afterAll(async () => {
  await db.store.deleteMany({ where: { id: { in: stores } } });
});

describe("admin coupons", () => {
  it("creates coupons the checkout accepts and pauses them", async () => {
    const { actor, variantId } = await fixture("quote");
    const c = await saveCoupon(actor, null, coupon());
    let quote = await buildQuote(actor.storeId, { lines: [{ variantId, quantity: 2 }], couponCode: "verano10" });
    expect(quote).toMatchObject({ couponCode: "VERANO10", couponDiscount: 2000, couponError: null });

    await setCouponActive(actor, c.id, false);
    quote = await buildQuote(actor.storeId, { lines: [{ variantId, quantity: 2 }], couponCode: "VERANO10" });
    expect(quote.couponError).toBe("El cupón no existe o no está activo.");

    await saveCoupon(actor, null, coupon({ code: "ENVIO", type: "FREE_SHIPPING", value: 999 }));
    expect((await listCoupons(actor.storeId)).find((x) => x.code === "ENVIO")?.value).toBe(0);
    await expect(saveCoupon(actor, null, coupon())).rejects.toMatchObject({ fieldErrors: { code: "Ya existe." } });
    await expect(saveCoupon(actor, null, coupon({ code: "MAL", value: 150 }))).rejects.toMatchObject({ fieldErrors: { value: expect.any(String) } });
  });

  it("protects coupons already used in orders", async () => {
    const { actor } = await fixture("used");
    const c = await saveCoupon(actor, null, coupon({ maxUses: 10 }));
    await db.coupon.update({ where: { id: c.id }, data: { usedCount: 4 } });
    await expect(saveCoupon(actor, c.id, coupon({ code: "OTRO", maxUses: 10 }))).rejects.toThrow("Este cupón ya se usó: no se puede cambiar el código. Creá uno nuevo.");
    await expect(saveCoupon(actor, c.id, coupon({ maxUses: 3 }))).rejects.toMatchObject({ fieldErrors: { maxUses: "Ya se usó 4 veces: el límite no puede ser menor." } });
    await expect(saveCoupon(actor, c.id, coupon({ maxUses: 4, value: 15 }))).resolves.toMatchObject({ code: "VERANO10" });
  });

  it("keeps coupons isolated per store", async () => {
    const [a, b] = [await fixture("a"), await fixture("b")];
    const c = await saveCoupon(a.actor, null, coupon());
    expect(await listCoupons(b.actor.storeId)).toEqual([]);
    await expect(saveCoupon(b.actor, c.id, coupon({ value: 90 }))).rejects.toThrow("No encontramos el cupón.");
    await expect(setCouponActive(b.actor, c.id, false)).rejects.toThrow("No encontramos el cupón.");
    // Another store can use the same code; it does not apply across stores.
    await expect(saveCoupon(b.actor, null, coupon({ value: 50 }))).resolves.toHaveProperty("id");
    const quote = await buildQuote(a.actor.storeId, { lines: [{ variantId: a.variantId, quantity: 1 }], couponCode: "VERANO10" });
    expect(quote.couponDiscount).toBe(1000);
    expect((await db.coupon.findUniqueOrThrow({ where: { id: c.id } })).value).toBe(10);
  });
});
