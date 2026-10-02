/**
 * Seeds the BM Dev superadmin and the five demo stores.
 * Idempotent: demo stores (isDemo = true) are dropped and recreated.
 * Real (non-demo) stores are never touched.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type OrderStatus, type PaymentMethod } from "../src/generated/prisma/client";
import { provisionStore } from "../src/lib/services/provision";
import { slugify } from "../src/lib/slug";
import { SEED_STORES, type SeedStore } from "./seed-data/stores";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: Number(process.env.DATABASE_POOL_MAX ?? 10) }) });

const images: Record<string, Record<string, string>> = JSON.parse(
  readFileSync(new URL("./seed-data/images.json", import.meta.url), "utf8"),
);

function img(store: string, key: string, kind: "product" | "banner" = "product"): string {
  const base = images[store]?.[key];
  if (!base) throw new Error(`Missing image ${store}/${key}`);
  return kind === "banner"
    ? `${base}?auto=format&fit=crop&w=2400&h=1350&q=80`
    : `${base}?auto=format&fit=crop&w=1200&h=1500&q=80`;
}

// Deterministic pseudo-random so every reseed produces the same demo.
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];

const FIRST = ["Camila", "Valentina", "Martina", "Lucía", "Julieta", "Agustina", "Florencia", "Micaela", "Rocío", "Paula", "Carolina", "Belén", "Sofía", "Milagros", "Nicolás", "Tomás", "Federico", "Lautaro"];
const LAST = ["González", "Rodríguez", "Fernández", "López", "Martínez", "Pérez", "Gómez", "Sánchez", "Romero", "Díaz", "Álvarez", "Torres", "Ruiz", "Benítez", "Acosta", "Medina"];
const PLACES: [string, string, string][] = [
  ["Av. Corrientes 4120", "CABA", "C1195AAN"],
  ["Thames 1850", "CABA", "C1414DDJ"],
  ["Av. Maipú 2300", "Vicente López", "B1636AAN"],
  ["Belgrano 845", "Quilmes", "B1878ECA"],
  ["San Martín 1520", "Córdoba", "X5000IIF"],
  ["Mitre 640", "Rosario", "S2000COR"],
  ["Av. Colón 1880", "Mar del Plata", "B7600FXR"],
  ["9 de Julio 330", "La Plata", "B1900AAG"],
];

async function seedSuperadmin() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("! SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set — skipping superadmin.");
    return;
  }
  await db.user.upsert({
    where: { email },
    create: { email, name: "BM Dev", role: "SUPERADMIN_BMDEV", passwordHash: await bcrypt.hash(password, 12) },
    update: {},
  });
  console.log(`✓ superadmin ${email}`);
}

async function seedStore(s: SeedStore, demoPasswordHash: string) {
  // Remove a previous demo copy (cascades to all its data).
  const previous = await db.store.findUnique({ where: { slug: s.slug } });
  if (previous && !previous.isDemo) {
    console.warn(`! store "${s.slug}" exists and is not a demo store — skipped.`);
    return;
  }
  if (previous) await db.store.delete({ where: { id: previous.id } });
  await db.user.deleteMany({ where: { email: s.ownerEmail, isDemo: true } });

  const { store } = await provisionStore(db, {
    name: s.name,
    slug: s.slug,
    domain: s.domain,
    ownerEmail: s.ownerEmail,
    ownerName: s.ownerName,
    industry: s.industry,
    template: s.template,
    plan: "PROFESIONAL",
    whatsapp: s.whatsapp,
    passwordHash: demoPasswordHash,
    isDemo: true,
    status: "ACTIVE",
  });
  const storeId = store.id;

  // Replace template starters with the curated catalogue.
  await db.category.deleteMany({ where: { storeId } });
  await db.coupon.deleteMany({ where: { storeId } });

  await db.storeSettings.update({
    where: { storeId },
    data: {
      tagline: s.tagline,
      description: s.description,
      announcement: s.announcement,
      instagram: s.instagram,
      email: s.email,
      phone: s.whatsapp,
      address: s.address,
      city: s.city,
      province: s.province,
      hours: s.hours,
      freeShippingThreshold: s.freeShippingThreshold,
      transferDiscountPct: s.transferDiscountPct,
      enableCash: s.enableCash,
      bankName: "Banco Galicia",
      bankHolder: `${s.name} S.R.L.`,
      bankCbu: "0070999000000000000017", // fictitious, valid check digits
      bankAlias: `${s.slug.toUpperCase()}.TIENDA.DEMO`,
      bankCuit: "30-00000000-7", // fictitious, valid check digit
      seoTitle: `${s.name} — ${s.tagline}`,
      seoDescription: s.description,
      footerText: s.description,
    },
  });
  await db.storeDomain.updateMany({ where: { storeId }, data: { verified: true } });

  const categoryIds = new Map<string, string>();
  for (const [i, c] of s.categories.entries()) {
    const cat = await db.category.create({
      data: {
        storeId,
        name: c.name,
        slug: slugify(c.name),
        description: c.description,
        imageUrl: c.image ? img(s.slug, c.image) : null,
        position: i,
      },
    });
    categoryIds.set(c.name, cat.id);
  }

  for (const [i, b] of s.banners.entries()) {
    await db.banner.create({
      data: {
        storeId,
        placement: b.placement,
        eyebrow: b.eyebrow,
        title: b.title,
        subtitle: b.subtitle,
        ctaLabel: b.ctaLabel,
        ctaHref: b.ctaHref,
        imageUrl: img(s.slug, b.image, "banner"),
        position: i,
      },
    });
  }

  for (const c of s.coupons) {
    await db.coupon.create({
      data: { storeId, code: c.code, description: c.description, type: c.type, value: c.value, minSubtotal: c.minSubtotal },
    });
  }

  const prefix = s.slug.slice(0, 3).toUpperCase();
  const createdVariants: { id: string; productId: string; name: string; label: string | null; sku: string; price: number; image: string }[] = [];
  const now = Date.now();
  for (const [pi, p] of s.products.entries()) {
    const sku = `${prefix}-${String(pi + 1).padStart(3, "0")}`;
    const product = await db.product.create({
      data: {
        storeId,
        categoryId: categoryIds.get(p.category) ?? null,
        name: p.name,
        slug: slugify(p.name),
        description: p.description,
        brand: p.brand,
        sku,
        price: p.price,
        compareAtPrice: p.compareAt ?? null,
        option1Name: p.variants.some((v) => v.o1) ? (p.option1Name ?? "Talle") : null,
        option2Name: p.variants.some((v) => v.o2) ? (p.option2Name ?? "Color") : null,
        featured: !!p.featured,
        isNew: !!p.isNew,
        soldCount: p.sold ?? 0,
        createdAt: new Date(now - (p.isNew ? 5 : 40 + pi) * 86400000),
        images: {
          create: p.images.map((key, idx) => ({
            storeId,
            url: img(s.slug, key),
            alt: idx === 0 ? p.name : `${p.name} — vista ${idx + 1}`,
            position: idx,
          })),
        },
      },
    });
    for (const [vi, v] of p.variants.entries()) {
      const vsku = `${sku}-${vi + 1}`;
      const variant = await db.productVariant.create({
        data: {
          storeId,
          productId: product.id,
          sku: vsku,
          option1: v.o1 ?? null,
          option2: v.o2 ?? null,
          colorHex: v.hex ?? null,
          price: v.price && v.price !== p.price ? v.price : null,
          stock: v.stock,
          position: vi,
        },
      });
      await db.stockMovement.create({
        data: { storeId, variantId: variant.id, delta: v.stock, stockAfter: v.stock, reason: "INITIAL", note: "Stock inicial" },
      });
      createdVariants.push({
        id: variant.id,
        productId: product.id,
        name: p.name,
        label: [v.o1, v.o2].filter(Boolean).join(" / ") || null,
        sku: vsku,
        price: v.price ?? p.price,
        image: img(s.slug, p.images[0]),
      });
    }
  }

  await seedOrders(s, storeId, createdVariants);
  console.log(`✓ ${s.name}: ${s.products.length} productos, ${createdVariants.length} variantes`);
}

async function seedOrders(
  s: SeedStore,
  storeId: string,
  variants: { id: string; productId: string; name: string; label: string | null; sku: string; price: number; image: string }[],
) {
  const count = s.slug === "alma" ? 46 : 14;
  const shipping = await db.shippingMethod.findMany({ where: { storeId }, orderBy: { position: "asc" } });
  const pickup = shipping.find((m) => m.type === "PICKUP")!;
  const delivery = shipping.filter((m) => m.type === "SHIPPING");
  const methods: PaymentMethod[] = ["MERCADOPAGO", "MERCADOPAGO", "TRANSFER", "MERCADOPAGO", "WHATSAPP", ...(s.enableCash ? ["CASH" as const] : [])];
  let seq = 1000;

  for (let i = 0; i < count; i++) {
    // Spread over the last 35 days, more recent orders more likely. Today gets a few.
    const daysAgo = i < 4 ? 0 : Math.floor(Math.pow(rand(), 1.6) * 35);
    const createdAt = new Date(Date.now() - daysAgo * 86400000 - Math.floor(rand() * 9 * 3600000));
    const first = pick(FIRST);
    const last = pick(LAST);
    const email = `${slugify(first)}.${slugify(last)}${Math.floor(rand() * 90 + 10)}@gmail.com`;
    const phone = `11${Math.floor(rand() * 90000000 + 10000000)}`;
    const nLines = rand() < 0.6 ? 1 : rand() < 0.8 ? 2 : 3;
    const lines = Array.from({ length: nLines }, () => pick(variants)).filter(
      (v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx,
    );
    const items = lines.map((v) => {
      const quantity = rand() < 0.85 ? 1 : 2;
      return { v, quantity, lineTotal: v.price * quantity };
    });
    const subtotal = items.reduce((a, it) => a + it.lineTotal, 0);
    const isPickup = rand() < 0.25;
    const method = isPickup ? pickup : pick(delivery);
    const settingsThreshold = s.freeShippingThreshold;
    const shippingTotal = isPickup || subtotal >= settingsThreshold ? 0 : method.price;
    const paymentMethod = pick(methods);
    const paymentDiscount = paymentMethod === "TRANSFER" ? Math.round((subtotal * s.transferDiscountPct) / 100) : 0;
    const total = subtotal - paymentDiscount + shippingTotal;

    let status: OrderStatus;
    if (daysAgo === 0) status = i % 2 === 0 ? "NEW" : "CONFIRMED";
    else if (daysAgo <= 2) status = pick(["NEW", "CONFIRMED", "PREPARING"] as const);
    else if (daysAgo <= 6) status = pick(["PREPARING", "SHIPPED", "SHIPPED"] as const);
    else status = rand() < 0.08 ? "CANCELLED" : "DELIVERED";
    const paid = status !== "NEW" && status !== "CANCELLED" ? true : paymentMethod === "MERCADOPAGO" && status === "NEW";
    const place = pick(PLACES);
    seq += 1;

    const customer = await db.customer.upsert({
      where: { storeId_email: { storeId, email } },
      create: { storeId, email, firstName: first, lastName: last, phone, ordersCount: 1, totalSpent: total, createdAt },
      update: { ordersCount: { increment: 1 }, totalSpent: { increment: total } },
    });

    const order = await db.order.create({
      data: {
        storeId,
        number: seq,
        publicToken: `demo-${s.slug}-${seq}-${Math.floor(rand() * 1e9).toString(36)}`,
        customerId: customer.id,
        status,
        paymentStatus: paid ? "PAID" : status === "CANCELLED" ? "FAILED" : "PENDING",
        paymentMethod,
        deliveryMethod: isPickup ? "PICKUP" : "SHIPPING",
        channel: paymentMethod === "WHATSAPP" ? "WHATSAPP" : "WEB",
        shippingMethodId: method.id,
        shippingMethodName: method.name,
        firstName: first,
        lastName: last,
        email,
        phone,
        street: isPickup ? null : place[0],
        city: isPickup ? null : place[1],
        province: isPickup ? null : place[1] === "CABA" ? "CABA" : place[1] === "Córdoba" ? "Córdoba" : place[1] === "Rosario" ? "Santa Fe" : "Buenos Aires",
        postalCode: isPickup ? null : place[2],
        subtotal,
        paymentDiscount,
        shippingTotal,
        total,
        createdAt,
        updatedAt: createdAt,
        items: {
          create: items.map((it) => ({
            storeId,
            productId: it.v.productId,
            variantId: it.v.id,
            productName: it.v.name,
            variantLabel: it.v.label,
            sku: it.v.sku,
            imageUrl: it.v.image,
            unitPrice: it.v.price,
            quantity: it.quantity,
            lineTotal: it.lineTotal,
          })),
        },
        events: {
          create: [
            { storeId, type: "created", message: "Pedido recibido desde la tienda online", createdAt },
            ...(paid ? [{ storeId, type: "payment", message: "Pago acreditado", createdAt: new Date(createdAt.getTime() + 600000) }] : []),
          ],
        },
      },
    });
    if (paid) {
      await db.payment.create({
        data: {
          storeId,
          orderId: order.id,
          provider: paymentMethod === "MERCADOPAGO" ? "mercadopago_demo" : "manual",
          status: "PAID",
          amount: total,
          createdAt,
        },
      });
    }
  }
  await db.store.update({ where: { id: storeId }, data: { orderSeq: seq } });
}

async function main() {
  await seedSuperadmin();
  const demoPassword = process.env.DEMO_ADMIN_PASSWORD;
  if (!demoPassword) throw new Error("DEMO_ADMIN_PASSWORD must be set to seed demo stores.");
  const hash = await bcrypt.hash(demoPassword, 12);
  for (const s of SEED_STORES) await seedStore(s, hash);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
