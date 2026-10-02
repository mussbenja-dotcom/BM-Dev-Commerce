import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import { createOrder, type CheckoutInput } from "@/lib/services/checkout";

let storeId: string; let variantId: string;
beforeAll(async () => {
  const store = await db.store.create({ data: { slug: `qa-stock-${randomUUID()}`, name: "Stock fixture", industry: "test", template: "minimal", status: "ACTIVE", settings: { create: { enableCash: true } } } });
  storeId = store.id;
  const product = await db.product.create({ data: { storeId, slug: "last-unit", name: "Última unidad", description: "Fixture", sku: "LAST", price: 1000, variants: { create: { storeId, sku: "LAST-1", stock: 1 } } }, include: { variants: true } });
  variantId = product.variants[0].id;
  await db.shippingMethod.create({ data: { storeId, name: "Retiro", type: "PICKUP", price: 0 } });
});
afterAll(async () => { if (storeId) await db.store.delete({ where: { id: storeId } }); await db.$disconnect(); });

const input = (): CheckoutInput => ({ lines: [{ variantId, quantity: 1 }], paymentMethod: "CASH", deliveryMethod: "PICKUP", firstName: "Ana", lastName: "Prueba", email: "qa@example.invalid", phone: "1155551234" });
it("sells the last unit once and rolls back the losing checkout", async () => {
  const results = await Promise.allSettled([createOrder(storeId, input(), randomUUID()), createOrder(storeId, input(), randomUUID())]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(0);
  expect(await db.order.count({ where: { storeId } })).toBe(1);
  expect(await db.stockMovement.count({ where: { storeId, reason: "SALE" } })).toBe(1);
});
it("does not exceed a coupon's last available use", async () => {
  await db.productVariant.update({ where: { id: variantId }, data: { stock: 2 } });
  await db.coupon.create({ data: { storeId, code: "LAST", type: "FIXED", value: 100, maxUses: 1 } });
  const results = await Promise.allSettled([createOrder(storeId, { ...input(), couponCode: "LAST" }, randomUUID()), createOrder(storeId, { ...input(), couponCode: "LAST" }, randomUUID())]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(1);
  expect((await db.coupon.findUniqueOrThrow({ where: { storeId_code: { storeId, code: "LAST" } } })).usedCount).toBe(1);
});
