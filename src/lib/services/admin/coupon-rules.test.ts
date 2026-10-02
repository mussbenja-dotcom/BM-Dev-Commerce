import { describe, expect, it } from "vitest";
import { couponInputErrors, couponState, normalizeCouponCode } from "./coupon-rules";

const now = new Date("2026-10-02T12:00:00Z");
const base = { active: true, startsAt: null, endsAt: null, maxUses: null, usedCount: 0 };

describe("couponState", () => {
  it("follows the same order as the checkout checks", () => {
    expect(couponState(base, now)).toBe("active");
    expect(couponState({ ...base, active: false }, now)).toBe("paused");
    expect(couponState({ ...base, endsAt: new Date("2026-10-01T00:00:00Z") }, now)).toBe("expired");
    expect(couponState({ ...base, maxUses: 3, usedCount: 3 }, now)).toBe("exhausted");
    expect(couponState({ ...base, startsAt: new Date("2026-10-05T00:00:00Z") }, now)).toBe("scheduled");
  });
});

describe("couponInputErrors", () => {
  const ok = { type: "PERCENT" as const, value: 10, startsAt: null, endsAt: null, maxUses: null };
  it("accepts a valid coupon", () => expect(couponInputErrors(ok)).toEqual({}));
  it("bounds percentages and fixed amounts", () => {
    expect(couponInputErrors({ ...ok, value: 0 })).toHaveProperty("value");
    expect(couponInputErrors({ ...ok, value: 101 })).toHaveProperty("value");
    expect(couponInputErrors({ ...ok, type: "FIXED", value: 0 })).toHaveProperty("value");
    expect(couponInputErrors({ ...ok, type: "FREE_SHIPPING", value: 0 })).toEqual({});
  });
  it("requires the end after the start", () => {
    const d = new Date("2026-10-02T03:00:00Z");
    expect(couponInputErrors({ ...ok, startsAt: d, endsAt: d })).toHaveProperty("endsAt");
  });
  it("does not let the limit drop below the uses already made", () => {
    expect(couponInputErrors({ ...ok, maxUses: 2 }, 5).maxUses).toBe("Ya se usó 5 veces: el límite no puede ser menor.");
    expect(couponInputErrors({ ...ok, maxUses: 0 })).toHaveProperty("maxUses");
    expect(couponInputErrors({ ...ok, maxUses: 5 }, 5)).toEqual({});
  });
});

it("normalizes codes like the checkout", () => {
  expect(normalizeCouponCode(" verano 10 ")).toBe("VERANO10");
});
