import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/payments/mercadopago", () => ({
  syncMercadoPagoPayment: vi.fn(),
  PaymentError: class extends Error { constructor(message: string, public status = 400) { super(message); } },
}));
import { syncMercadoPagoPayment, PaymentError } from "@/lib/services/payments/mercadopago";
import { POST } from "./route";
const ctx = { params: Promise.resolve({ storeId: "store-a" }) };
const notify = (body: unknown) => POST(new Request("http://localhost/api/webhooks/mercadopago/store-a", { method: "POST", body: JSON.stringify(body) }), ctx);
beforeEach(() => vi.mocked(syncMercadoPagoPayment).mockReset());
it("rejects malformed bodies and payment identifiers", async () => {
  for (const body of [null, {}, { type: "payment" }, { type: "payment", data: { id: "../other" } }]) expect((await notify(body)).status).toBe(400);
  expect(syncMercadoPagoPayment).not.toHaveBeenCalled();
});
it("ignores unrelated events", async () => {
  expect((await notify({ type: "merchant_order" })).status).toBe(200);
  expect(syncMercadoPagoPayment).not.toHaveBeenCalled();
});
it("only forwards the tenant and ID, ignoring claimed status and amount", async () => {
  expect((await notify({ type: "payment", data: { id: 123 }, status: "approved", amount: 1 })).status).toBe(200);
  expect(syncMercadoPagoPayment).toHaveBeenCalledExactlyOnceWith("store-a", "123");
});
it("returns retryable failures for provider and database errors", async () => {
  vi.mocked(syncMercadoPagoPayment).mockRejectedValueOnce(new PaymentError("No disponible", 502));
  expect((await notify({ type: "payment", data: { id: 123 } })).status).toBe(502);
  vi.mocked(syncMercadoPagoPayment).mockRejectedValueOnce(new Error("database credentials"));
  const response = await notify({ type: "payment", data: { id: 123 } });
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("credentials");
});
