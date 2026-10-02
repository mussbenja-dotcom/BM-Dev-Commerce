import type { CouponType } from "@/generated/prisma/enums";

/** Pure coupon rules shared by the admin service and UI. No server-only imports. */

export type CouponLike = { active: boolean; startsAt: Date | null; endsAt: Date | null; maxUses: number | null; usedCount: number };
export type CouponState = "active" | "scheduled" | "expired" | "exhausted" | "paused";

export const COUPON_STATE_LABEL: Record<CouponState, string> = {
  active: "Vigente",
  scheduled: "Programado",
  expired: "Vencido",
  exhausted: "Sin usos",
  paused: "Pausado",
};

export const COUPON_TYPE_LABEL: Record<CouponType, string> = {
  PERCENT: "Porcentaje",
  FIXED: "Monto fijo",
  FREE_SHIPPING: "Envío gratis",
};

/** Mirrors the checks the checkout runs (src/lib/pricing.ts couponError). */
export function couponState(c: CouponLike, now = new Date()): CouponState {
  if (!c.active) return "paused";
  if (c.endsAt && c.endsAt < now) return "expired";
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return "exhausted";
  if (c.startsAt && c.startsAt > now) return "scheduled";
  return "active";
}

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export const COUPON_CODE = /^[A-Z0-9_-]{3,30}$/;

export type CouponRuleInput = { type: CouponType; value: number; startsAt: Date | null; endsAt: Date | null; maxUses: number | null };

/** Field errors for a coupon (empty object when valid). usedCount guards edits of a coupon already in use. */
export function couponInputErrors(input: CouponRuleInput, usedCount = 0): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.type === "PERCENT" && (input.value < 1 || input.value > 100)) errors.value = "Ingresá un porcentaje entre 1 y 100.";
  if (input.type === "FIXED" && input.value < 1) errors.value = "Ingresá un monto mayor a 0.";
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) errors.endsAt = "La fecha de fin tiene que ser posterior al inicio.";
  if (input.maxUses !== null && input.maxUses < Math.max(1, usedCount)) {
    errors.maxUses = usedCount > 0 ? `Ya se usó ${usedCount} ${usedCount === 1 ? "vez" : "veces"}: el límite no puede ser menor.` : "El límite tiene que ser al menos 1.";
  }
  return errors;
}

export function describeCoupon(c: { type: CouponType; value: number }, formatPrice: (n: number) => string): string {
  if (c.type === "PERCENT") return `${c.value} % de descuento`;
  if (c.type === "FIXED") return `${formatPrice(c.value)} de descuento`;
  return "Envío gratis";
}
