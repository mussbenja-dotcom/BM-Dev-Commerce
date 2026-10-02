import { describe, expect, it } from "vitest";
import { canAdvance, canCancel, cancelNeedsRefundAck, manualPaymentTargets, nextStatuses } from "./order-rules";

describe("order status rules", () => {
  it("only moves forward and allows skipping steps", () => {
    expect(nextStatuses("NEW")).toEqual(["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"]);
    expect(nextStatuses("SHIPPED")).toEqual(["DELIVERED"]);
    expect(canAdvance("PREPARING", "CONFIRMED")).toBe(false);
    expect(canAdvance("NEW", "NEW")).toBe(false);
    expect(canAdvance("NEW", "SHIPPED")).toBe(true);
  });

  it("closes delivered and cancelled orders", () => {
    expect(nextStatuses("DELIVERED")).toEqual([]);
    expect(nextStatuses("CANCELLED")).toEqual([]);
    expect(canAdvance("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canAdvance("NEW", "CANCELLED")).toBe(false);
    expect(canCancel("DELIVERED")).toBe(false);
    expect(canCancel("CANCELLED")).toBe(false);
    expect(canCancel("SHIPPED")).toBe(true);
  });

  it("requires refund acknowledgement only for paid orders", () => {
    expect(cancelNeedsRefundAck("PAID")).toBe(true);
    expect(cancelNeedsRefundAck("PENDING")).toBe(false);
    expect(cancelNeedsRefundAck("REFUNDED")).toBe(false);
  });
});

describe("manual payment rules", () => {
  it("never changes Mercado Pago payments by hand", () => {
    expect(manualPaymentTargets({ paymentMethod: "MERCADOPAGO", paymentStatus: "PENDING", status: "NEW" })).toEqual([]);
  });

  it("lets manual methods be marked paid, undone or refunded", () => {
    expect(manualPaymentTargets({ paymentMethod: "TRANSFER", paymentStatus: "PENDING", status: "NEW" })).toEqual(["PAID"]);
    expect(manualPaymentTargets({ paymentMethod: "CASH", paymentStatus: "PAID", status: "PREPARING" })).toEqual(["PENDING", "REFUNDED"]);
    expect(manualPaymentTargets({ paymentMethod: "WHATSAPP", paymentStatus: "REFUNDED", status: "NEW" })).toEqual([]);
  });

  it("only allows refunding a cancelled order", () => {
    expect(manualPaymentTargets({ paymentMethod: "TRANSFER", paymentStatus: "PENDING", status: "CANCELLED" })).toEqual([]);
    expect(manualPaymentTargets({ paymentMethod: "TRANSFER", paymentStatus: "PAID", status: "CANCELLED" })).toEqual(["REFUNDED"]);
  });
});
