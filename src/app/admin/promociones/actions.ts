"use server";

import { z } from "zod";
import { requireStoreSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { AdminError, ok, revalidateStore, run, zf } from "@/lib/services/admin/common";
import type { ActionResult, ActionState } from "@/lib/services/admin/types";
import type { Actor } from "@/lib/services/admin/orders";
import { COUPON_CODE, normalizeCouponCode } from "@/lib/services/admin/coupon-rules";
import { saveCoupon, setCouponActive } from "@/lib/services/admin/coupons";
import { saveBanner } from "@/lib/services/admin/banners";

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

async function actor(): Promise<Actor> {
  const session = await requireStoreSession();
  return { storeId: session.storeId, userId: session.userId };
}

const couponSchema = z.object({
  code: z.string().transform(normalizeCouponCode).pipe(z.string().regex(COUPON_CODE, "Usá de 3 a 30 letras, números, - o _.")),
  description: zf.optional(120),
  type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"], { message: "Elegí el tipo de descuento." }),
  value: z.string(),
  minSubtotal: zf.optionalMoney("Ingresá un monto mínimo válido."),
  maxUses: zf.optionalInt(1, 1_000_000, "Ingresá un número de usos válido."),
  startsAt: zf.optionalDate(),
  endsAt: zf.optionalDate(true),
  active: zf.bool,
});
const KEYS = Object.keys(couponSchema.shape);

export async function saveCouponAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const couponId = str(fd, "couponId").slice(0, 40) || null;
    const parsed = couponSchema.parse(Object.fromEntries(KEYS.map((k) => [k, str(fd, k)])));
    // Percent is a plain integer; fixed is money. Free shipping has no value.
    const valueSchema = parsed.type === "PERCENT" ? zf.int(0, 100, "Ingresá un porcentaje entre 1 y 100.") : zf.money("Ingresá un monto válido.");
    const valueResult = valueSchema.safeParse(parsed.value.replace("%", ""));
    if (parsed.type !== "FREE_SHIPPING" && !valueResult.success) {
      const message = valueResult.error.issues[0]?.message ?? "Revisá el valor.";
      throw new AdminError(message, { value: message });
    }
    const value = parsed.type === "FREE_SHIPPING" || !valueResult.success ? 0 : valueResult.data;
    const r = await saveCoupon(a, couponId, { ...parsed, value });
    await audit({ action: couponId ? "coupon.update" : "coupon.create", storeId: a.storeId, userId: a.userId, entity: "coupon", entityId: r.id, meta: { code: r.code } });
    await revalidateStore(a.storeId);
    return ok(couponId ? "Cupón guardado." : `Cupón ${r.code} creado.`, { id: r.id });
  });
}

const activeSchema = z.object({ couponId: z.string().trim().min(1).max(40), active: z.enum(["true", "false"]).transform((v) => v === "true") });

export async function setCouponActiveAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const input = activeSchema.parse({ couponId: str(fd, "couponId"), active: str(fd, "active") });
    await setCouponActive(a, input.couponId, input.active);
    await audit({ action: input.active ? "coupon.activate" : "coupon.pause", storeId: a.storeId, userId: a.userId, entity: "coupon", entityId: input.couponId });
    await revalidateStore(a.storeId);
    return ok(input.active ? "Cupón activado." : "Cupón pausado.");
  });
}

const bannerSchema = z.object({
  placement: z.enum(["hero", "promo"], { message: "Elegí dónde se muestra." }),
  eyebrow: zf.optional(60),
  title: zf.required(90, "Ingresá el título."),
  subtitle: zf.optional(160),
  ctaLabel: zf.optional(30),
  ctaHref: zf.optional(200),
  imageUrl: zf.optionalUrl().refine((v): v is string => v !== null, "Ingresá la imagen."),
  mobileImageUrl: zf.optionalUrl(),
  position: zf.int(0, 99, "Usá un número entre 0 y 99."),
  active: zf.bool,
});
const BANNER_KEYS = Object.keys(bannerSchema.shape);

export async function saveBannerAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const bannerId = str(fd, "bannerId").slice(0, 40) || null;
    const raw = Object.fromEntries(BANNER_KEYS.map((k) => [k, str(fd, k)]));
    const input = bannerSchema.parse({ ...raw, position: raw.position || "0" });
    const r = await saveBanner(a, bannerId, { ...input, imageUrl: input.imageUrl as string });
    await audit({ action: bannerId ? "banner.update" : "banner.create", storeId: a.storeId, userId: a.userId, entity: "banner", entityId: r.id });
    await revalidateStore(a.storeId, { storefront: true });
    return ok(bannerId ? "Banner guardado." : "Banner creado.", { id: r.id });
  });
}
