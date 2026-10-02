import { describe, expect, it } from "vitest";
import { computeQuote, couponError, MAX_QTY_PER_LINE, type PricingCoupon, type PricingInput, type PricingVariant } from "./pricing";

const now = new Date("2026-10-02T15:00:00Z");
const variant = (id: string, extra: Partial<PricingVariant> = {}): PricingVariant => ({
  variantId: id, productId: `p-${id}`, productName: `Producto ${id}`, productSlug: id, variantLabel: null, sku: id.toUpperCase(),
  imageUrl: null, unitPrice: 10000, compareAtPrice: null, stock: 10, available: true, ...extra,
});
const coupon = (extra: Partial<PricingCoupon> = {}): PricingCoupon => ({
  code: "BIENVENIDA10", type: "PERCENT", value: 10, minSubtotal: null, maxUses: null, usedCount: 0, startsAt: null, endsAt: null, active: true, ...extra,
});
const input = (extra: Partial<PricingInput> = {}): PricingInput => ({
  lines: [{ variantId: "a", quantity: 2 }],
  variants: new Map([["a", variant("a")], ["b", variant("b", { unitPrice: 5000, stock: 1 })]]),
  coupon: null, couponCodeRequested: null, shipping: null, paymentMethod: null, transferDiscountPct: 0, freeShippingThreshold: null, now, ...extra,
});

describe("computeQuote", () => {
  it("prices from the server variants, merging duplicated lines", () => {
    const q = computeQuote(input({ lines: [{ variantId: "a", quantity: 1 }, { variantId: "a", quantity: 2 }] }));
    expect(q).toMatchObject({ subtotal: 30000, itemCount: 3, total: 30000, issues: [] });
    expect(q.lines).toHaveLength(1);
  });

  it("ignores bad quantities and caps each line", () => {
    const q = computeQuote(input({ lines: [{ variantId: "a", quantity: -3 }, { variantId: "b", quantity: 0.5 }] }));
    expect(q.lines).toEqual([]);
    const big = computeQuote(input({ variants: new Map([["a", variant("a", { stock: 999 })]]), lines: [{ variantId: "a", quantity: 999 }] }));
    expect(big.itemCount).toBe(MAX_QTY_PER_LINE);
  });

  it("reports unavailable variants and clamps to stock", () => {
    const q = computeQuote(input({ lines: [{ variantId: "b", quantity: 3 }, { variantId: "ghost", quantity: 1 }] }));
    expect(q.issues).toEqual([{ variantId: "b", kind: "insufficient_stock", available: 1 }, { variantId: "ghost", kind: "unavailable", available: 0 }]);
    expect(q.subtotal).toBe(5000);
  });

  it("applies percent, fixed and free-shipping coupons", () => {
    const shipping = { id: "s", name: "Moto", type: "SHIPPING" as const, price: 3000 };
    expect(computeQuote(input({ coupon: coupon(), couponCodeRequested: "BIENVENIDA10", shipping })).total).toBe(18000 + 3000);
    expect(computeQuote(input({ coupon: coupon({ code: "ALMA5000", type: "FIXED", value: 50000 }), couponCodeRequested: "ALMA5000" })).couponDiscount).toBe(20000);
    const free = computeQuote(input({ coupon: coupon({ code: "ENVIOGRATIS", type: "FREE_SHIPPING", value: 0 }), couponCodeRequested: "ENVIOGRATIS", shipping }));
    expect(free).toMatchObject({ freeShippingByCoupon: true, shippingTotal: 0, total: 20000 });
  });

  it("reports coupon errors without discounting", () => {
    const q = computeQuote(input({ coupon: null, couponCodeRequested: "NOEXISTE" }));
    expect(q).toMatchObject({ couponError: "El cupón no existe o no está activo.", couponDiscount: 0, total: 20000 });
  });

  it("gives free shipping from the threshold after the coupon, and reports how much is missing", () => {
    const shipping = { id: "s", name: "Correo", type: "SHIPPING" as const, price: 9800 };
    expect(computeQuote(input({ shipping, freeShippingThreshold: 20000 }))).toMatchObject({ freeShippingByThreshold: true, shippingTotal: 0 });
    const below = computeQuote(input({ shipping, freeShippingThreshold: 20000, coupon: coupon(), couponCodeRequested: "BIENVENIDA10" }));
    expect(below).toMatchObject({ freeShippingByThreshold: false, amountToFreeShipping: 2000, shippingTotal: 9800 });
  });

  it("charges nothing for pickup and discounts transfer on the amount after the coupon (max 50 %)", () => {
    const pickup = { id: "r", name: "Retiro", type: "PICKUP" as const, price: 999 };
    const q = computeQuote(input({ shipping: pickup, paymentMethod: "TRANSFER", transferDiscountPct: 10, coupon: coupon(), couponCodeRequested: "BIENVENIDA10" }));
    expect(q).toMatchObject({ shippingTotal: 0, couponDiscount: 2000, paymentDiscount: 1800, total: 16200 });
    expect(computeQuote(input({ paymentMethod: "TRANSFER", transferDiscountPct: 90 })).paymentDiscount).toBe(10000);
    expect(computeQuote(input({ paymentMethod: "CASH", transferDiscountPct: 10 })).paymentDiscount).toBe(0);
  });
});

describe("couponError", () => {
  it("checks status, dates, uses and minimum", () => {
    expect(couponError(coupon({ active: false }), 1, now)).toBe("El cupón no existe o no está activo.");
    expect(couponError(coupon({ startsAt: new Date("2026-10-03T00:00:00Z") }), 1, now)).toBe("El cupón todavía no está vigente.");
    expect(couponError(coupon({ endsAt: new Date("2026-10-01T00:00:00Z") }), 1, now)).toBe("El cupón está vencido.");
    expect(couponError(coupon({ maxUses: 2, usedCount: 2 }), 1, now)).toBe("El cupón alcanzó su límite de usos.");
    expect(couponError(coupon({ minSubtotal: 60000 }), 59999, now)).toContain("compra mínima");
    expect(couponError(coupon(), 1, now)).toBeNull();
  });
});
