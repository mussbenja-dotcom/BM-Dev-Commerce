import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { CouponType } from "@/generated/prisma/enums";
import { AdminError } from "./common";
import type { Actor } from "./orders";
import { couponInputErrors } from "./coupon-rules";

export type CouponInput = {
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  minSubtotal: number | null;
  maxUses: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
};

export async function listCoupons(storeId: string) {
  return db.coupon.findMany({ where: { storeId }, orderBy: [{ active: "desc" }, { createdAt: "desc" }] });
}

function assertValid(input: CouponInput, usedCount: number) {
  const errors = couponInputErrors(input, usedCount);
  const first = Object.values(errors)[0];
  if (first) throw new AdminError(Object.keys(errors).length > 1 ? "Revisá los campos marcados." : first, errors);
}

const normalize = (input: CouponInput): CouponInput => (input.type === "FREE_SHIPPING" ? { ...input, value: 0 } : input);

export async function saveCoupon(actor: Actor, couponId: string | null, raw: CouponInput) {
  const input = normalize(raw);
  try {
    return await db.$transaction(async (tx) => {
      const clash = await tx.coupon.findFirst({ where: { storeId: actor.storeId, code: input.code, ...(couponId ? { id: { not: couponId } } : {}) }, select: { id: true } });
      if (clash) throw new AdminError("Ya tenés un cupón con ese código.", { code: "Ya existe." });
      if (!couponId) {
        assertValid(input, 0);
        return tx.coupon.create({ data: { ...input, storeId: actor.storeId }, select: { id: true, code: true } });
      }
      // Lock against a checkout incrementing usedCount while the limit is being edited.
      const rows = await tx.$queryRaw<{ id: string; code: string; usedCount: number }[]>`
        SELECT id, code, "usedCount" FROM "Coupon" WHERE id = ${couponId} AND "storeId" = ${actor.storeId} FOR UPDATE`;
      const current = rows[0];
      if (!current) throw new AdminError("No encontramos el cupón.");
      // Orders keep the code they used; renaming a used coupon would break cancellations and reports.
      if (current.usedCount > 0 && current.code !== input.code) {
        throw new AdminError("Este cupón ya se usó: no se puede cambiar el código. Creá uno nuevo.", { code: "Ya se usó en pedidos." });
      }
      assertValid(input, current.usedCount);
      return tx.coupon.update({ where: { id: current.id }, data: input, select: { id: true, code: true } });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new AdminError("Ya tenés un cupón con ese código.", { code: "Ya existe." });
    throw err;
  }
}

/** Coupons are paused, never deleted: orders reference their code. */
export async function setCouponActive(actor: Actor, couponId: string, active: boolean) {
  const r = await db.coupon.updateMany({ where: { id: couponId, storeId: actor.storeId }, data: { active } });
  if (!r.count) throw new AdminError("No encontramos el cupón.");
}
