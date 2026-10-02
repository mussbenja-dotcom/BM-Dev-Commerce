import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import { computeQuote, MAX_QTY_PER_LINE, type PricingCoupon, type PricingVariant, type Quote } from "@/lib/pricing";
import type { PaymentMethod, Prisma } from "@/generated/prisma/client";

export const cartLinesSchema = z
  .array(
    z.object({
      variantId: z.string().min(1).max(40),
      quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
    }),
  )
  .max(50);

export const quoteRequestSchema = z.object({
  lines: cartLinesSchema,
  couponCode: z.string().trim().max(40).optional().nullable(),
  shippingMethodId: z.string().max(40).optional().nullable(),
  paymentMethod: z.enum(["MERCADOPAGO", "TRANSFER", "CASH", "WHATSAPP"]).optional().nullable(),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

const PROVINCES = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos",
  "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta",
  "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
] as const;
export const ARGENTINE_PROVINCES: readonly string[] = PROVINCES;

export const checkoutSchema = quoteRequestSchema.extend({
  lines: cartLinesSchema.min(1, "El carrito está vacío."),
  paymentMethod: z.enum(["MERCADOPAGO", "TRANSFER", "CASH", "WHATSAPP"]),
  deliveryMethod: z.enum(["SHIPPING", "PICKUP"]),
  firstName: z.string().trim().min(2, "Ingresá tu nombre.").max(60),
  lastName: z.string().trim().min(2, "Ingresá tu apellido.").max(60),
  email: z.string().trim().toLowerCase().max(120).pipe(z.email("Ingresá un email válido.")),
  phone: z
    .string()
    .trim()
    .min(8, "Ingresá un teléfono válido.")
    .max(30)
    .regex(/^[0-9+()\s-]+$/, "Ingresá un teléfono válido."),
  street: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  province: z.string().trim().max(60).optional().nullable(),
  postalCode: z.string().trim().max(10).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

async function loadVariants(storeId: string, ids: string[]) {
  const variants = await db.productVariant.findMany({
    where: { storeId, id: { in: ids } },
    include: {
      product: {
        select: {
          id: true, name: true, slug: true, price: true, compareAtPrice: true, active: true,
          option1Name: true, option2Name: true,
          images: { take: 1, orderBy: { position: "asc" }, select: { url: true } },
        },
      },
    },
  });
  const map = new Map<string, PricingVariant>();
  for (const v of variants) {
    const label = [v.option1, v.option2].filter(Boolean).join(" / ") || null;
    map.set(v.id, {
      variantId: v.id,
      productId: v.product.id,
      productName: v.product.name,
      productSlug: v.product.slug,
      variantLabel: label,
      sku: v.sku,
      imageUrl: v.product.images[0]?.url ?? null,
      unitPrice: v.price ?? v.product.price,
      compareAtPrice: v.product.compareAtPrice,
      stock: v.stock,
      available: v.active && v.product.active,
    });
  }
  return map;
}

async function loadCoupon(storeId: string, code: string | null | undefined): Promise<PricingCoupon | null> {
  if (!code) return null;
  return db.coupon.findUnique({
    where: { storeId_code: { storeId, code: code.trim().toUpperCase() } },
    select: {
      code: true, type: true, value: true, minSubtotal: true, maxUses: true,
      usedCount: true, startsAt: true, endsAt: true, active: true,
    },
  });
}

export async function getShippingMethods(storeId: string) {
  return db.shippingMethod.findMany({
    where: { storeId, active: true },
    orderBy: { position: "asc" },
    select: { id: true, name: true, description: true, type: true, price: true, provinces: true, estimatedDays: true },
  });
}

export async function buildQuote(storeId: string, req: QuoteRequest): Promise<Quote> {
  const [settings, variants, coupon, shipping] = await Promise.all([
    db.storeSettings.findUnique({
      where: { storeId },
      select: { transferDiscountPct: true, freeShippingThreshold: true },
    }),
    loadVariants(storeId, req.lines.map((l) => l.variantId)),
    loadCoupon(storeId, req.couponCode),
    req.shippingMethodId
      ? db.shippingMethod.findFirst({
          where: { id: req.shippingMethodId, storeId, active: true },
          select: { id: true, name: true, type: true, price: true },
        })
      : null,
  ]);
  return computeQuote({
    lines: req.lines,
    variants,
    coupon,
    couponCodeRequested: req.couponCode?.trim() ? req.couponCode.trim().toUpperCase() : null,
    shipping,
    paymentMethod: req.paymentMethod ?? null,
    transferDiscountPct: settings?.transferDiscountPct ?? 0,
    freeShippingThreshold: settings?.freeShippingThreshold ?? null,
  });
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    public code: "VALIDATION" | "STOCK" | "COUPON" | "PAYMENT" | "SHIPPING" = "VALIDATION",
  ) {
    super(message);
  }
}

/**
 * Creates the order. Everything monetary is recomputed from the DB.
 * Stock is decremented with a conditional update so two buyers can never
 * oversell the last unit.
 */
export async function createOrder(storeId: string, input: CheckoutInput, checkoutKey?: string) {
  const settings = await db.storeSettings.findUnique({ where: { storeId } });
  const activeStore = await db.store.findFirst({ where: { id: storeId, status: "ACTIVE" }, select: { id: true } });
  if (!settings || !activeStore) throw new CheckoutError("Tienda no disponible.");

  const enabled: Record<PaymentMethod, boolean> = {
    MERCADOPAGO: settings.enableMercadoPago,
    TRANSFER: settings.enableTransfer,
    CASH: settings.enableCash,
    WHATSAPP: settings.enableWhatsappOrder,
  };
  if (!enabled[input.paymentMethod]) throw new CheckoutError("Ese medio de pago no está disponible.", "PAYMENT");

  let shippingMethodId: string | null = null;
  if (input.deliveryMethod === "SHIPPING") {
    if (!input.street || !input.city || !input.province || !input.postalCode) {
      throw new CheckoutError("Completá la dirección de envío.", "SHIPPING");
    }
    if (!ARGENTINE_PROVINCES.includes(input.province)) throw new CheckoutError("Elegí una provincia válida.", "SHIPPING");
    if (!input.shippingMethodId) throw new CheckoutError("Elegí un método de envío.", "SHIPPING");
    const method = await db.shippingMethod.findFirst({
      where: { id: input.shippingMethodId, storeId, active: true, type: "SHIPPING" },
    });
    if (!method) throw new CheckoutError("El método de envío no es válido.", "SHIPPING");
    if (method.provinces.length && !method.provinces.includes(input.province)) {
      throw new CheckoutError(`"${method.name}" no llega a ${input.province}.`, "SHIPPING");
    }
    shippingMethodId = method.id;
  } else {
    const pickup = await db.shippingMethod.findFirst({ where: { storeId, active: true, type: "PICKUP" } });
    if (!pickup) throw new CheckoutError("Esta tienda no ofrece retiro en el local.", "SHIPPING");
    shippingMethodId = pickup.id;
  }

  const quote = await buildQuote(storeId, { ...input, shippingMethodId });
  if (quote.issues.length) {
    throw new CheckoutError("Algunos productos ya no tienen stock suficiente. Revisá tu carrito.", "STOCK");
  }
  if (!quote.lines.length) throw new CheckoutError("El carrito está vacío.");
  if (input.couponCode?.trim() && quote.couponError) throw new CheckoutError(quote.couponError, "COUPON");

  const shippingName = (await db.shippingMethod.findUnique({ where: { id: shippingMethodId! }, select: { name: true } }))?.name ?? null;
  const delivery = input.deliveryMethod;

  return db.$transaction(async (tx) => {
    // Atomic stock decrement; fails if someone else bought the last units.
    for (const line of quote.lines) {
      const updated = await tx.productVariant.updateMany({
        where: { id: line.variantId, storeId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (updated.count !== 1) {
        throw new CheckoutError(`Se agotó "${line.productName}". Revisá tu carrito.`, "STOCK");
      }
    }

    if (quote.couponCode) {
      const c = await tx.coupon.updateMany({
        where: {
          storeId,
          code: quote.couponCode,
          active: true,
          OR: [{ maxUses: null }, { usedCount: { lt: tx.coupon.fields.maxUses } }],
        },
        data: { usedCount: { increment: 1 } },
      });
      if (c.count !== 1) throw new CheckoutError("El cupón ya no está disponible.", "COUPON");
    }

    const store = await tx.store.update({
      where: { id: storeId },
      data: { orderSeq: { increment: 1 } },
      select: { orderSeq: true },
    });

    const customer = await tx.customer.upsert({
      where: { storeId_email: { storeId, email: input.email } },
      create: {
        storeId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        ordersCount: 1,
        totalSpent: quote.total,
      },
      update: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        ordersCount: { increment: 1 },
        totalSpent: { increment: quote.total },
      },
    });

    if (delivery === "SHIPPING") {
      const existing = await tx.address.findFirst({
        where: { storeId, customerId: customer.id, street: input.street!, postalCode: input.postalCode! },
        select: { id: true },
      });
      if (!existing) {
        await tx.address.create({
          data: {
            storeId,
            customerId: customer.id,
            street: input.street!,
            city: input.city!,
            province: input.province!,
            postalCode: input.postalCode!,
          },
        });
      }
    }

    const order = await tx.order.create({
      data: {
        storeId,
        number: store.orderSeq,
        publicToken: randomToken(18),
        checkoutKey,
        customerId: customer.id,
        paymentMethod: input.paymentMethod,
        deliveryMethod: delivery,
        channel: input.paymentMethod === "WHATSAPP" ? "WHATSAPP" : "WEB",
        shippingMethodId,
        shippingMethodName: shippingName,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        street: delivery === "SHIPPING" ? input.street : null,
        city: delivery === "SHIPPING" ? input.city : null,
        province: delivery === "SHIPPING" ? input.province : null,
        postalCode: delivery === "SHIPPING" ? input.postalCode : null,
        notes: input.notes || null,
        couponCode: quote.couponCode,
        subtotal: quote.subtotal,
        discountTotal: quote.couponDiscount,
        paymentDiscount: quote.paymentDiscount,
        shippingTotal: quote.shippingTotal,
        total: quote.total,
        items: {
          create: quote.lines.map((l) => ({
            storeId,
            productId: l.productId,
            variantId: l.variantId,
            productName: l.productName,
            variantLabel: l.variantLabel,
            sku: l.sku,
            imageUrl: l.imageUrl,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            lineTotal: l.lineTotal,
          })),
        },
        events: {
          create: {
            storeId,
            type: "created",
            message:
              input.paymentMethod === "WHATSAPP"
                ? "Pedido iniciado por WhatsApp"
                : "Pedido recibido desde la tienda online",
          },
        },
      },
      select: { id: true, number: true, publicToken: true, total: true, paymentMethod: true },
    });

    const stockData: Prisma.StockMovementCreateManyInput[] = [];
    for (const line of quote.lines) {
      const v = await tx.productVariant.findUnique({ where: { id: line.variantId }, select: { stock: true } });
      stockData.push({
        storeId,
        variantId: line.variantId,
        delta: -line.quantity,
        stockAfter: v?.stock ?? 0,
        reason: "SALE",
        orderId: order.id,
        note: `Pedido #${order.number}`,
      });
    }
    await tx.stockMovement.createMany({ data: stockData });

    for (const line of quote.lines) {
      await tx.product.update({ where: { id: line.productId }, data: { soldCount: { increment: line.quantity } } });
    }

    return { order, quote };
  });
}
