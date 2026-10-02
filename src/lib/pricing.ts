/**
 * Pure pricing engine. The server is the only source of truth for money:
 * it loads products/variants/coupons from the DB and runs them through here.
 * Client-sent prices are never read.
 */

export type PricingVariant = {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantLabel: string | null;
  sku: string;
  imageUrl: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  stock: number;
  available: boolean;
};

export type PricingCoupon = {
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  value: number;
  minSubtotal: number | null;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
};

export type PricingShipping = {
  id: string;
  name: string;
  type: "SHIPPING" | "PICKUP";
  price: number;
};

export type PricingInput = {
  lines: { variantId: string; quantity: number }[];
  variants: Map<string, PricingVariant>;
  coupon: PricingCoupon | null;
  couponCodeRequested: string | null;
  shipping: PricingShipping | null;
  paymentMethod: "MERCADOPAGO" | "TRANSFER" | "CASH" | "WHATSAPP" | null;
  transferDiscountPct: number;
  freeShippingThreshold: number | null;
  now?: Date;
};

export type QuoteLine = PricingVariant & { quantity: number; lineTotal: number };

export type LineIssue = {
  variantId: string;
  kind: "unavailable" | "insufficient_stock";
  available: number;
};

export type Quote = {
  lines: QuoteLine[];
  issues: LineIssue[];
  itemCount: number;
  subtotal: number;
  couponCode: string | null;
  couponDiscount: number;
  couponError: string | null;
  freeShippingByCoupon: boolean;
  shippingTotal: number;
  freeShippingByThreshold: boolean;
  amountToFreeShipping: number | null;
  paymentDiscount: number;
  total: number;
};

export const MAX_QTY_PER_LINE = 20;

export function couponError(coupon: PricingCoupon | null, subtotal: number, now: Date): string | null {
  if (!coupon || !coupon.active) return "El cupón no existe o no está activo.";
  if (coupon.startsAt && coupon.startsAt > now) return "El cupón todavía no está vigente.";
  if (coupon.endsAt && coupon.endsAt < now) return "El cupón está vencido.";
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return "El cupón alcanzó su límite de usos.";
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    return `El cupón requiere una compra mínima de $${coupon.minSubtotal.toLocaleString("es-AR")}.`;
  }
  return null;
}

export function computeQuote(input: PricingInput): Quote {
  const now = input.now ?? new Date();
  const lines: QuoteLine[] = [];
  const issues: LineIssue[] = [];

  // Merge duplicated variant lines and clamp quantities.
  const merged = new Map<string, number>();
  for (const l of input.lines) {
    const q = Math.floor(Number(l.quantity));
    if (!Number.isFinite(q) || q <= 0) continue;
    merged.set(l.variantId, Math.min(MAX_QTY_PER_LINE, (merged.get(l.variantId) ?? 0) + q));
  }

  for (const [variantId, requested] of merged) {
    const v = input.variants.get(variantId);
    if (!v || !v.available || v.stock <= 0) {
      issues.push({ variantId, kind: "unavailable", available: 0 });
      continue;
    }
    let quantity = requested;
    if (requested > v.stock) {
      issues.push({ variantId, kind: "insufficient_stock", available: v.stock });
      quantity = v.stock;
    }
    lines.push({ ...v, quantity, lineTotal: v.unitPrice * quantity });
  }

  const subtotal = lines.reduce((acc, l) => acc + l.lineTotal, 0);
  const itemCount = lines.reduce((acc, l) => acc + l.quantity, 0);

  let couponDiscount = 0;
  let freeShippingByCoupon = false;
  let couponCode: string | null = null;
  let couponErr: string | null = null;
  if (input.couponCodeRequested) {
    couponErr = couponError(input.coupon, subtotal, now);
    if (!couponErr && input.coupon) {
      couponCode = input.coupon.code;
      if (input.coupon.type === "PERCENT") {
        const pct = Math.min(100, Math.max(0, input.coupon.value));
        couponDiscount = Math.round((subtotal * pct) / 100);
      } else if (input.coupon.type === "FIXED") {
        couponDiscount = Math.min(subtotal, Math.max(0, input.coupon.value));
      } else {
        freeShippingByCoupon = true;
      }
    }
  }

  const afterCoupon = subtotal - couponDiscount;
  const threshold = input.freeShippingThreshold;
  const freeShippingByThreshold = !!threshold && afterCoupon >= threshold && subtotal > 0;
  const amountToFreeShipping = threshold && !freeShippingByThreshold ? Math.max(0, threshold - afterCoupon) : null;

  let shippingTotal = 0;
  if (input.shipping && input.shipping.type === "SHIPPING" && subtotal > 0) {
    shippingTotal = freeShippingByCoupon || freeShippingByThreshold ? 0 : input.shipping.price;
  }

  let paymentDiscount = 0;
  if (input.paymentMethod === "TRANSFER" && input.transferDiscountPct > 0) {
    const pct = Math.min(50, input.transferDiscountPct);
    paymentDiscount = Math.round((afterCoupon * pct) / 100);
  }

  const total = Math.max(0, afterCoupon - paymentDiscount + shippingTotal);

  return {
    lines,
    issues,
    itemCount,
    subtotal,
    couponCode,
    couponDiscount,
    couponError: couponErr,
    freeShippingByCoupon,
    shippingTotal,
    freeShippingByThreshold,
    amountToFreeShipping,
    paymentDiscount,
    total,
  };
}
