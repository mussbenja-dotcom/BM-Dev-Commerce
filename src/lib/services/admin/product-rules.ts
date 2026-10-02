/**
 * Pure rules for the merchant's catalog and stock. Shared by the server
 * service and the UI. No server-only imports.
 */

export const MAX_STOCK = 1_000_000;

export type StockAdjustMode = "set" | "add" | "remove";

/**
 * Computes the new stock for a manual adjustment.
 * "set" is a physical count (the merchant counted N units); "add"/"remove" move units in or out.
 */
export function computeStockAdjustment(current: number, mode: StockAdjustMode, quantity: number): { next: number; delta: number } | { error: string } {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_STOCK) return { error: "Ingresá una cantidad entre 0 y 1.000.000." };
  if (mode !== "set" && quantity === 0) return { error: "Ingresá una cantidad mayor a 0." };
  const next = mode === "set" ? quantity : mode === "add" ? current + quantity : current - quantity;
  if (next < 0) return { error: `No podés descontar más de lo que hay en stock (${current}).` };
  if (next > MAX_STOCK) return { error: "El stock no puede superar 1.000.000 unidades." };
  if (next === current) return { error: "El stock ya tiene ese valor." };
  return { next, delta: next - current };
}

export function variantLabel(v: { option1?: string | null; option2?: string | null }): string {
  return [v.option1, v.option2].filter(Boolean).join(" / ") || "Única";
}

export function isLowStock(v: { stock: number; lowStockAlert: number }): boolean {
  return v.stock <= v.lowStockAlert;
}

/** "Remera Básica" -> "REMERA-BASICA". SKUs are compared case-insensitively by uppercasing. */
export function normalizeSku(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** A sale price above the regular one is not an offer. */
export function compareAtError(price: number, compareAt: number | null): string | null {
  return compareAt !== null && compareAt <= price ? "El precio anterior tiene que ser mayor al precio de venta." : null;
}

export const STOCK_REASON_LABEL = {
  INITIAL: "Stock inicial",
  SALE: "Venta",
  ADJUSTMENT: "Ajuste manual",
  CANCEL_RESTOCK: "Pedido cancelado",
} as const;
