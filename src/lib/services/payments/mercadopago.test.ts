import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { db, tx } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    order: { findFirstOrThrow: vi.fn(), update: vi.fn() },
    payment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    orderEvent: { create: vi.fn() },
  };
  return { tx, db: { order: { findFirst: vi.fn() }, storeSettings: { findUnique: vi.fn() }, payment: { create: vi.fn() }, $transaction: vi.fn(async (fn) => fn(tx)) } };
});
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/crypto", () => ({ decryptSecret: () => "private-token" }));
import { applyPaymentResult, startMercadoPagoPayment, syncMercadoPagoPayment } from "./mercadopago";

const settings = { mpMode: "PRODUCTION", mpAccessTokenEnc: "encrypted", enableMercadoPago: true, maxInstallments: 3 };
const order = {
  id: "order-a", storeId: "store-a", total: 12345, number: 1001, publicToken: "public-token", status: "NEW", paymentStatus: "PENDING", paymentMethod: "MERCADOPAGO",
  store: { name: "Alma", slug: "alma", status: "ACTIVE", isDemo: false, domains: [], settings },
};
const result = { storeId: "store-a", orderId: "order-a", externalId: "123", amount: 12345, status: "PAID" as const };
const providerPayment = { id: 123, external_reference: "order-a", transaction_amount: 12345, currency_id: "ARS", live_mode: true, status: "approved", metadata: { store_id: "store-a" } };
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://commerce.example");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  db.order.findFirst.mockResolvedValue(structuredClone(order));
  db.storeSettings.findUnique.mockResolvedValue({ ...settings });
  tx.$queryRaw.mockResolvedValue([{ id: order.id }]);
  tx.order.findFirstOrThrow.mockResolvedValue(structuredClone(order));
  tx.payment.findFirst.mockResolvedValue(null);
  tx.payment.count.mockResolvedValue(0);
});

describe("preferences", () => {
  it("uses the saved total in pesos, tenant metadata and trusted return URLs", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "preference", init_point: "https://www.mercadopago.com.ar/checkout" }));
    await expect(startMercadoPagoPayment("store-a", "order-a")).resolves.toEqual({ demo: false, url: "https://www.mercadopago.com.ar/checkout" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mercadopago.com/checkout/preferences");
    expect(JSON.parse(init.body)).toMatchObject({ items: [{ unit_price: 12345, currency_id: "ARS" }], external_reference: "order-a", metadata: { store_id: "store-a" }, back_urls: { success: "https://commerce.example/s/alma/pedido/public-token" } });
    expect(db.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ storeId: "store-a", amount: 12345, preferenceId: "preference" }) });
  });
  it("uses sandbox URL for sandbox credentials", async () => {
    db.order.findFirst.mockResolvedValue({ ...order, store: { ...order.store, settings: { ...settings, mpMode: "SANDBOX" } } });
    fetchMock.mockResolvedValue(Response.json({ id: "p", init_point: "https://live.example", sandbox_init_point: "https://sandbox.example" }));
    expect((await startMercadoPagoPayment("store-a", "order-a")).url).toBe("https://sandbox.example");
  });
  it("allows simulation only for demo stores", async () => {
    db.order.findFirst.mockResolvedValue({ ...order, store: { ...order.store, settings: { ...settings, mpAccessTokenEnc: null } } });
    await expect(startMercadoPagoPayment("store-a", "order-a")).rejects.toThrow("configuró");
    db.order.findFirst.mockResolvedValue({ ...order, store: { ...order.store, isDemo: true, settings: { ...settings, mpMode: "DEMO" } } });
    await expect(startMercadoPagoPayment("store-a", "order-a")).resolves.toEqual({ demo: true, url: "https://commerce.example/s/alma/pago/public-token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["CANCELLED", "paid"])('rejects an order that is %s', async (state) => {
    db.order.findFirst.mockResolvedValue({ ...order, ...(state === "paid" ? { paymentStatus: "PAID" } : { status: state }) });
    await expect(startMercadoPagoPayment("store-a", "order-a")).rejects.toThrow("nuevo pago");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns a retryable error without leaking the provider body", async () => {
    fetchMock.mockResolvedValue(new Response("sensitive details", { status: 500 }));
    await expect(startMercadoPagoPayment("store-a", "order-a")).rejects.toMatchObject({ status: 502 });
    expect(db.payment.create).not.toHaveBeenCalled();
  });
});

describe("authoritative provider lookup", () => {
  it("fetches the payment with this store's credential and confirms the order", async () => {
    fetchMock.mockResolvedValue(Response.json(providerPayment));
    tx.payment.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await syncMercadoPagoPayment("store-a", "123");
    expect(fetchMock).toHaveBeenCalledWith("https://api.mercadopago.com/v1/payments/123", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer private-token" }) }));
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: "order-a", storeId: "store-a" }, data: { paymentStatus: "PAID", status: "CONFIRMED" } });
  });
  it.each([{ currency_id: "USD" }, { metadata: { store_id: "store-b" } }, { live_mode: false }, { id: 124 }, { transaction_amount: 1 }])("rejects mismatched payment %j", async (override) => {
    fetchMock.mockResolvedValue(Response.json({ ...providerPayment, ...override }));
    await expect(syncMercadoPagoPayment("store-a", "123")).rejects.toThrow();
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });
  it("rejects an order from another store even with forged metadata", async () => {
    fetchMock.mockResolvedValue(Response.json(providerPayment));
    tx.$queryRaw.mockResolvedValue([]);
    await expect(syncMercadoPagoPayment("store-b", "123")).rejects.toThrow();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});

describe("payment state transitions", () => {
  it.each(["PAID", "REFUNDED"])("ignores duplicate or stale notifications after %s", async (status) => {
    tx.payment.findFirst.mockResolvedValue({ id: "p", orderId: "order-a", status });
    expect(await applyPaymentResult({ ...result, status: status === "PAID" ? "PENDING" : "PAID" })).toEqual({ changed: false });
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });
  it("does not duplicate an approved notification", async () => {
    tx.payment.findFirst.mockResolvedValue({ id: "p", orderId: "order-a", status: "PAID" });
    expect(await applyPaymentResult(result)).toEqual({ changed: false });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
  it("records refunds", async () => {
    tx.payment.findFirst.mockResolvedValue({ id: "p", orderId: "order-a", status: "PAID" });
    tx.payment.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await applyPaymentResult({ ...result, status: "REFUNDED" });
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { paymentStatus: "REFUNDED" } }));
  });
  it("keeps an order paid when another attempt fails", async () => {
    tx.payment.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await applyPaymentResult({ ...result, status: "FAILED" });
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentStatus: "PAID" }) }));
  });
  it("records late payments without reopening cancelled orders", async () => {
    tx.order.findFirstOrThrow.mockResolvedValue({ ...order, status: "CANCELLED" });
    tx.payment.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await applyPaymentResult(result);
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { paymentStatus: "PAID" } }));
    expect(tx.orderEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ message: expect.stringContaining("requiere revisión") }) });
  });
  it("rejects simulated results for real stores", async () => {
    await expect(applyPaymentResult({ ...result, demo: true })).rejects.toMatchObject({ status: 403 });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
