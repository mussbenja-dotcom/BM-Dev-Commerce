import { describe, expect, it } from "vitest";
import { compareAtError, computeStockAdjustment, isLowStock, normalizeSku, variantLabel } from "./product-rules";

describe("computeStockAdjustment", () => {
  it("sets a physical count", () => {
    expect(computeStockAdjustment(7, "set", 3)).toEqual({ next: 3, delta: -4 });
    expect(computeStockAdjustment(0, "set", 12)).toEqual({ next: 12, delta: 12 });
  });
  it("adds and removes units", () => {
    expect(computeStockAdjustment(5, "add", 10)).toEqual({ next: 15, delta: 10 });
    expect(computeStockAdjustment(5, "remove", 5)).toEqual({ next: 0, delta: -5 });
  });
  it("never goes below zero or above the limit", () => {
    expect(computeStockAdjustment(2, "remove", 3)).toEqual({ error: "No podés descontar más de lo que hay en stock (2)." });
    expect(computeStockAdjustment(999_999, "add", 2)).toHaveProperty("error");
  });
  it("rejects invalid or no-op quantities", () => {
    expect(computeStockAdjustment(2, "add", 0)).toHaveProperty("error");
    expect(computeStockAdjustment(2, "set", -1)).toHaveProperty("error");
    expect(computeStockAdjustment(2, "set", 1.5)).toHaveProperty("error");
    expect(computeStockAdjustment(2, "set", 2)).toEqual({ error: "El stock ya tiene ese valor." });
  });
});

describe("catalog helpers", () => {
  it("labels variants", () => {
    expect(variantLabel({ option1: "M", option2: "Negro" })).toBe("M / Negro");
    expect(variantLabel({ option1: null, option2: null })).toBe("Única");
  });
  it("flags low stock at the alert threshold", () => {
    expect(isLowStock({ stock: 3, lowStockAlert: 3 })).toBe(true);
    expect(isLowStock({ stock: 4, lowStockAlert: 3 })).toBe(false);
  });
  it("normalizes SKUs", () => {
    expect(normalizeSku(" remera básica / m ")).toBe("REMERA-BASICA-M");
  });
  it("requires the previous price to be higher", () => {
    expect(compareAtError(1000, 1000)).not.toBeNull();
    expect(compareAtError(1000, 1200)).toBeNull();
    expect(compareAtError(1000, null)).toBeNull();
  });
});
