import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import { createOrder, type CheckoutInput } from "@/lib/services/checkout";
import { addOrderNote, advanceOrderStatus, cancelOrder, getOrder, listOrders, setManualPaymentStatus, type Actor } from "@/lib/services/admin/orders";

type Fixture = { actor: Actor; variantId: string; productId: string };
const stores: string[] = [];

async function fixture(label: string): Promise<Fixture> {
  const store = await db.store.create({
    data: {
      slug: `qa-admin-${label}-${randomUUID()}`,
      name: `Admin ${label}`,
      industry: "test",
      template: "minimal",
      status: "ACTIVE",
      settings: { create: { enableCash: true, enableTransfer: true } },
    },
  });
  stores.push(store.id);
  const user = await db.user.create({
    data: { email: `qa-${randomUUID()}@example.invalid`, name: "QA", passwordHash: "x", role: "STORE_OWNER", storeId: store.id },
  });
  const product = await db.product.create({
    data: {
      storeId: store.id, slug: "p", name: "Producto", description: "Fixture", sku: `P-${label}`, price: 1000,
      variants: { create: { storeId: store.id, sku: `P-${label}-1`, stock: 5 } },
    },
    include: { variants: true },
  });
  await db.shippingMethod.create({ data: { storeId: store.id, name: "Retiro", type: "PICKUP", price: 0 } });
  return { actor: { storeId: store.id, userId: user.id }, variantId: product.variants[0].id, productId: product.id };
}

const input = (f: Fixture, quantity = 2, extra: Partial<CheckoutInput> = {}): CheckoutInput => ({
  lines: [{ variantId: f.variantId, quantity }],
  paymentMethod: "CASH",
  deliveryMethod: "PICKUP",
  firstName: "Ana",
  lastName: "Prueba",
  email: "qa-admin@example.invalid",
  phone: "1155551234",
  ...extra,
});

const stock = async (variantId: string) => (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;

let a: Fixture;
let b: Fixture;
beforeAll(async () => {
  a = await fixture("a");
  b = await fixture("b");
});
afterAll(async () => {
  for (const id of stores) await db.store.delete({ where: { id } });
  await db.$disconnect();
});

describe("tenant isolation", () => {
  it("never reads or mutates another store's order", async () => {
    const { order } = await createOrder(b.actor.storeId, input(b, 1), randomUUID());
    expect(await getOrder(a.actor.storeId, order.id)).toBeNull();
    expect((await listOrders(a.actor.storeId, { page: 1, q: String(order.number) })).rows.map((r) => r.id)).not.toContain(order.id);

    const foreign = { ...a.actor };
    await expect(advanceOrderStatus(foreign, order.id, "CONFIRMED")).rejects.toThrow("No encontramos el pedido.");
    await expect(cancelOrder(foreign, order.id, { reason: null, refundAcknowledged: true })).rejects.toThrow("No encontramos el pedido.");
    await expect(setManualPaymentStatus(foreign, order.id, "PAID")).rejects.toThrow("No encontramos el pedido.");
    await expect(addOrderNote(foreign, order.id, "intrusa")).rejects.toThrow("No encontramos el pedido.");

    const untouched = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { events: true } });
    expect(untouched.status).toBe("NEW");
    expect(untouched.paymentStatus).toBe("PENDING");
    expect(untouched.events).toHaveLength(1);
    expect(await stock(b.variantId)).toBe(4);
  });
});

describe("status changes", () => {
  it("moves forward only and records an event", async () => {
    const { order } = await createOrder(a.actor.storeId, input(a, 1), randomUUID());
    await advanceOrderStatus(a.actor, order.id, "PREPARING");
    await expect(advanceOrderStatus(a.actor, order.id, "CONFIRMED")).rejects.toThrow();
    await advanceOrderStatus(a.actor, order.id, "DELIVERED");
    await expect(cancelOrder(a.actor, order.id, { reason: null, refundAcknowledged: false })).rejects.toThrow("entregado");
    const events = await db.orderEvent.findMany({ where: { orderId: order.id, type: "status" } });
    expect(events).toHaveLength(2);
  });
});

describe("cancellation", () => {
  it("restocks once even when cancelled twice at the same time", async () => {
    const before = await stock(a.variantId);
    await db.coupon.create({ data: { storeId: a.actor.storeId, code: "QA10", type: "FIXED", value: 100 } });
    const { order } = await createOrder(a.actor.storeId, input(a, 2, { couponCode: "QA10" }), randomUUID());
    expect(await stock(a.variantId)).toBe(before - 2);
    const customerBefore = await db.customer.findFirstOrThrow({ where: { storeId: a.actor.storeId } });

    const results = await Promise.allSettled([
      cancelOrder(a.actor, order.id, { reason: "Prueba", refundAcknowledged: false }),
      cancelOrder(a.actor, order.id, { reason: "Prueba", refundAcknowledged: false }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(cancelOrder(a.actor, order.id, { reason: null, refundAcknowledged: false })).rejects.toThrow("ya estaba cancelado");

    expect(await stock(a.variantId)).toBe(before);
    expect(await db.stockMovement.count({ where: { orderId: order.id, reason: "CANCEL_RESTOCK" } })).toBe(1);
    expect((await db.coupon.findUniqueOrThrow({ where: { storeId_code: { storeId: a.actor.storeId, code: "QA10" } } })).usedCount).toBe(0);
    const customerAfter = await db.customer.findUniqueOrThrow({ where: { id: customerBefore.id } });
    expect(customerAfter.ordersCount).toBe(customerBefore.ordersCount - 1);
    expect(customerAfter.totalSpent).toBe(customerBefore.totalSpent - order.total);
    const cancelled = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(cancelled.status).toBe("CANCELLED");
    expect(await db.orderEvent.count({ where: { orderId: order.id, type: "cancelled" } })).toBe(1);
  });

  it("requires acknowledging the refund for paid orders and keeps the payment status", async () => {
    const { order } = await createOrder(a.actor.storeId, input(a, 1, { paymentMethod: "TRANSFER" }), randomUUID());
    await setManualPaymentStatus(a.actor, order.id, "PAID");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CONFIRMED");

    await expect(cancelOrder(a.actor, order.id, { reason: null, refundAcknowledged: false })).rejects.toThrow("reintegro");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CONFIRMED");

    await cancelOrder(a.actor, order.id, { reason: null, refundAcknowledged: true });
    const cancelled = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.paymentStatus).toBe("PAID");

    await expect(setManualPaymentStatus(a.actor, order.id, "PENDING")).rejects.toThrow();
    await setManualPaymentStatus(a.actor, order.id, "REFUNDED");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("REFUNDED");
  });

  it("never edits Mercado Pago payment status by hand", async () => {
    const { order } = await createOrder(a.actor.storeId, input(a, 1), randomUUID());
    await db.order.update({ where: { id: order.id }, data: { paymentMethod: "MERCADOPAGO" } });
    await expect(setManualPaymentStatus(a.actor, order.id, "PAID")).rejects.toThrow("Mercado Pago");
  });
});
