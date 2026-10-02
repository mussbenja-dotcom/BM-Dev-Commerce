import { describe, expect, it } from "vitest";
import { isValidCbu, isValidCuit, mercadoPagoAvailable, paymentSettingsErrors } from "./settings-rules";

// Built with the official weights: bank 285 / branch 0590, account 0000094040123.
const VALID_CBU = "2850590900000940401231";

describe("bank identifiers", () => {
  it("validates CBU check digits", () => {
    expect(isValidCbu(VALID_CBU)).toBe(true);
    expect(isValidCbu("2850590900000940401232")).toBe(false);
    expect(isValidCbu("2850591900000940401231")).toBe(false);
    expect(isValidCbu("28505909000009404012")).toBe(false);
    expect(isValidCbu("28505909 00000940401231")).toBe(true);
    expect(isValidCbu("2850590900000940401231x")).toBe(false);
  });
  it("accepts the fictitious values used by the demo seed", () => {
    expect(isValidCbu("0070999000000000000017")).toBe(true);
    expect(isValidCuit("30-00000000-7")).toBe(true);
  });
  it("validates CUIT check digits", () => {
    expect(isValidCuit("20-12345678-6")).toBe(true);
    expect(isValidCuit("20123456780")).toBe(false);
    expect(isValidCuit("30-71234567-1")).toBe(true);
    expect(isValidCuit("30-71234567-2")).toBe(false);
  });
});

describe("paymentSettingsErrors", () => {
  const base = { enableMercadoPago: false, enableTransfer: true, enableCash: false, enableWhatsappOrder: false, bankHolder: "Ana", bankCbu: null, bankAlias: "mi.alias.mp", bankCuit: null };
  it("accepts transfer with alias and holder", () => expect(paymentSettingsErrors(base, false)).toEqual({}));
  it("requires transfer data", () => {
    expect(paymentSettingsErrors({ ...base, bankAlias: null, bankHolder: null }, false)).toMatchObject({ bankAlias: expect.any(String), bankHolder: expect.any(String) });
  });
  it("requires at least one usable method", () => {
    const none = { ...base, enableTransfer: false, enableMercadoPago: true };
    expect(paymentSettingsErrors(none, false)).toHaveProperty("enableTransfer");
    expect(paymentSettingsErrors(none, true)).toEqual({});
  });
  it("checks optional bank fields when present", () => {
    expect(paymentSettingsErrors({ ...base, bankCbu: "123", bankCuit: "1", bankAlias: "a b" }, false)).toMatchObject({ bankCbu: expect.any(String), bankCuit: expect.any(String), bankAlias: expect.any(String) });
  });
  it("knows when Mercado Pago can charge", () => {
    expect(mercadoPagoAvailable({ isDemo: true, mpMode: "DEMO", hasToken: false })).toBe(true);
    expect(mercadoPagoAvailable({ isDemo: false, mpMode: "DEMO", hasToken: true })).toBe(false);
    expect(mercadoPagoAvailable({ isDemo: false, mpMode: "PRODUCTION", hasToken: true })).toBe(true);
  });
});
