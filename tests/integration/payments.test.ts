import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import { applyPaymentResult } from "@/lib/services/payments/mercadopago";
import { randomUUID } from "node:crypto";

let storeId: string;
let orderId: string;
beforeAll(async () => {
  const store = await db.store.create({ data: { slug: `qa-payments-${randomUUID()}`, name: "Payment integration fixture", industry: "test", template: "minimal", status: "ACTIVE" } });
  storeId = store.id;
  const order = await db.order.create({ data: {
    storeId, number: 1, publicToken: randomUUID(), paymentMethod: "MERCADOPAGO", deliveryMethod: "PICKUP",
    firstName: "Test", lastName: "Fixture", email: "test@example.invalid", phone: "1111111111", subtotal: 1500, total: 1500,
  } });
  orderId = order.id;
});
afterAll(async () => {
  if (storeId) await db.store.delete({ where: { id: storeId } });
  await db.$disconnect();
});

it("serializes simultaneous approvals and records one payment/event, then a refund", async () => {
  const result = { storeId, orderId, amount: 1500, externalId: "integration-123", status: "PAID" as const };
  const responses = await Promise.all(Array.from({ length: 5 }, () => applyPaymentResult(result)));
  expect(responses.filter((r) => r.changed)).toHaveLength(1);
  expect(await db.payment.count({ where: { storeId, orderId } })).toBe(1);
  expect(await db.orderEvent.count({ where: { storeId, orderId } })).toBe(1);
  expect(await db.order.findUnique({ where: { id: orderId } })).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
  await expect(applyPaymentResult({ ...result, storeId: "other-store" })).rejects.toThrow("no encontrado");
  await expect(applyPaymentResult({ ...result, amount: 1 })).rejects.toThrow("no coincide");
  await applyPaymentResult({ ...result, status: "REFUNDED" });
  await applyPaymentResult(result);
  expect(await db.order.findUnique({ where: { id: orderId } })).toMatchObject({ paymentStatus: "REFUNDED" });
  expect(await db.orderEvent.count({ where: { storeId, orderId } })).toBe(2);
});
