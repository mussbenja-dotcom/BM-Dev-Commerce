import { test, expect, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { TEMPLATES } from "../../src/lib/templates";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: Number(process.env.DATABASE_POOL_MAX ?? 1) }) });
const slug = `qa-${randomUUID()}`;
let storeId: string; let variantId: string; let pickupId: string; let foreignStoreId: string; let foreignVariantId: string;
const foreignSlug = `${slug}-other`;
const imageUrl = "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80";
const email = "comprador@example.invalid";
test.beforeAll(async () => {
  const theme = { ...TEMPLATES.fashion.theme, template: "fashion" };
  const store = await db.store.create({ data: {
    slug, name: "Tienda QA", industry: "Moda", template: "fashion", isDemo: true, status: "ACTIVE",
    theme: { create: { ...theme, homeSections: ["hero", "categories", "featured", "benefits"] } },
    settings: { create: { enableMercadoPago: true, enableTransfer: true, enableCash: true, enableWhatsappOrder: true, whatsapp: "5491155550123", transferDiscountPct: 10, freeShippingThreshold: 50000, mpMode: "DEMO", bankAlias: "qa.transferencia", bankHolder: "Comercio QA", shippingPolicy: "Envíos de prueba.", returnsPolicy: "Cambios de prueba.", privacyPolicy: "Privacidad de prueba." } },
  } });
  storeId = store.id;
  const category = await db.category.create({ data: { storeId, slug: "remeras", name: "Remeras", imageUrl } });
  const product = await db.product.create({ data: {
    storeId, categoryId: category.id, slug: "remera-qa", name: "Remera QA", description: "Una remera para probar el recorrido de compra.", sku: "QA-REM", price: 20000, compareAtPrice: 25000, featured: true, active: true, option1Name: "Talle", option2Name: "Color",
    images: { create: { storeId, url: imageUrl, alt: "Remera QA" } },
    variants: { create: [{ storeId, sku: "QA-S", option1: "S", option2: "Negro", stock: 30 }, { storeId, sku: "QA-M", option1: "M", option2: "Negro", stock: 0 }] },
  }, include: { variants: true } });
  variantId = product.variants.find((v) => v.option1 === "S")!.id;
  const pickup = await db.shippingMethod.create({ data: { storeId, name: "Retiro QA", type: "PICKUP", price: 0 } });
  pickupId = pickup.id;
  await db.shippingMethod.create({ data: { storeId, name: "Envío QA", type: "SHIPPING", price: 3000, provinces: ["CABA"], estimatedDays: "2 a 4 días" } });
  await db.coupon.create({ data: { storeId, code: "BIENVENIDA10", type: "PERCENT", value: 10, active: true } });
  const foreign = await db.store.create({ data: { slug: foreignSlug, name: "Otra tienda QA", industry: "Moda", template: "fashion", status: "ACTIVE", theme: { create: theme }, settings: { create: {} } } });
  foreignStoreId = foreign.id;
  const foreignProduct = await db.product.create({ data: { storeId: foreign.id, slug: "ajeno", name: "Ajeno", description: "Producto de otra tienda", sku: "AJENO", price: 1, variants: { create: { storeId: foreign.id, sku: "AJENO-1", stock: 10 } } }, include: { variants: true } });
  foreignVariantId = foreignProduct.variants[0].id;
});
test.afterAll(async () => {
  if (storeId) await db.store.delete({ where: { id: storeId } });
  if (foreignStoreId) await db.store.delete({ where: { id: foreignStoreId } });
  await db.$disconnect();
});

async function addProduct(page: Page) {
  await page.goto(`/s/${slug}/productos/remera-qa`);
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(page.getByRole("button", { name: "Agregar al carrito" })).toBeDisabled();
  await page.getByRole("button", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("dialog", { name: "Tu carrito" })).toBeVisible();
  await page.getByRole("link", { name: "Iniciar compra" }).click();
  await expect(page.getByRole("heading", { name: "Finalizar compra" })).toBeVisible();
}
async function customer(page: Page) {
  await page.getByLabel("Nombre", { exact: true }).fill("Ana");
  await page.getByLabel("Apellido", { exact: true }).fill("Prueba");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Teléfono", { exact: true }).fill("1155551234");
}

test("home, search, category, filters, gallery and responsive layout", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [390, 430, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/s/${slug}`);
    await expect(page.getByRole("heading", { name: "Tienda QA", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width < 1024) { await page.getByRole("button", { name: "Abrir menú" }).click(); await expect(page.getByRole("dialog", { name: "Menú" })).toBeVisible(); await page.keyboard.press("Escape"); }
  }
  await page.getByRole("textbox", { name: "Buscar productos" }).fill("Remera");
  await expect(page.getByRole("list", { name: "Sugerencias de búsqueda" })).toContainText("Remera QA");
  await page.goto(`/s/${slug}/categorias/remeras?stock=1&oferta=1&talle=S`);
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Filtrar y ordenar" }).click();
  await expect(page.getByRole("dialog", { name: "Filtros" })).toBeVisible();
  await page.getByLabel("Ordenar", { exact: true }).selectOption("precio-asc");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/orden=precio-asc/);
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await page.goto(`/s/${slug}/productos?min=999999`);
  await expect(page.getByText("No encontramos productos con esos filtros.")).toBeVisible();
  await page.goto(`/s/${slug}/productos/remera-qa`);
  await page.getByRole("button", { name: "Ampliar imagen del producto" }).click();
  await expect(page.getByRole("dialog", { name: "Remera QA" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto(`/s/${slug}/politicas/envios`);
  await expect(page.getByText("Envíos de prueba.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile cart -> shipping -> coupon -> bank transfer -> persisted order", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const before = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  await addProduct(page); await customer(page);
  await page.getByLabel("Provincia", { exact: true }).selectOption("CABA");
  await page.getByLabel("Ciudad", { exact: true }).fill("Buenos Aires");
  await page.getByLabel("Calle, número y departamento").fill("Calle Falsa 123");
  await page.getByLabel("Código postal").fill("1000");
  await page.getByRole("radio", { name: /Transferencia bancaria/ }).check();
  await page.getByRole("textbox", { name: "Cupón de descuento" }).fill("INVALIDO");
  await expect(page.getByRole("alert").filter({ hasText: "no existe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar pedido" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Cupón de descuento" }).fill("BIENVENIDA10");
  await expect(page.getByRole("button", { name: "Confirmar pedido" })).toBeEnabled();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${slug}/pedido/`));
  await expect(page.getByText("qa.transferencia", { exact: true })).toBeVisible();
  await expect(page.getByTestId("payment-status")).toHaveText("Pago: Pendiente");
  const token = page.url().split("/").pop()!;
  const order = await db.order.findUniqueOrThrow({ where: { publicToken: token }, include: { items: true } });
  expect(order).toMatchObject({ storeId, subtotal: 20000, discountTotal: 2000, paymentDiscount: 1800, shippingTotal: 3000, total: 19200, paymentMethod: "TRANSFER" });
  expect(order.items).toHaveLength(1);
  expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(before.stock - 1);
  expect(await db.stockMovement.count({ where: { storeId, orderId: order.id, reason: "SALE" } })).toBe(1);
  expect(await page.evaluate((slug) => JSON.parse(localStorage.getItem(`bm_cart_${slug}`)!).items.length, slug)).toBe(0);
});

test("Mercado Pago demo rejects, retries, approves and persists one approval", async ({ page }) => {
  await addProduct(page); await customer(page);
  await page.getByRole("radio", { name: "Retiro en el local", exact: true }).check();
  await expect(page.getByRole("button", { name: "Confirmar pedido" })).toBeEnabled();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${slug}/pago/`));
  await page.getByRole("button", { name: "Simular pago rechazado" }).click();
  await expect(page.getByTestId("payment-status")).toHaveText("Pago: Rechazado");
  await page.getByRole("button", { name: "Pagar con Mercado Pago" }).click();
  await page.getByRole("button", { name: "Simular pago pendiente" }).click();
  await expect(page.getByTestId("payment-status")).toHaveText("Pago: Pendiente");
  await page.getByRole("button", { name: "Pagar con Mercado Pago" }).click();
  await page.getByRole("button", { name: "Simular pago aprobado" }).click();
  await expect(page.getByTestId("payment-status")).toHaveText("Pago: Pagado");
  const token = page.url().split("/").pop()!;
  const order = await db.order.findUniqueOrThrow({ where: { publicToken: token } });
  expect(order.status).toBe("CONFIRMED");
  expect(await db.payment.count({ where: { storeId, orderId: order.id, status: "PAID" } })).toBe(1);
});

test("API rejects CSRF and foreign variants; cash retries are idempotent; WhatsApp uses saved totals", async ({ request }) => {
  const headers = { Origin: "http://localhost:3100" };
  const body = { checkoutKey: randomUUID(), lines: [{ variantId, quantity: 1 }], paymentMethod: "CASH", deliveryMethod: "PICKUP", shippingMethodId: pickupId, firstName: "Ana", lastName: "Prueba", email, phone: "1155551234" };
  const endpoint = `/api/store/${slug}/orders`;
  expect((await request.post(endpoint, { data: body })).status()).toBe(403);
  expect((await request.post(endpoint, { headers, data: { ...body, lines: [{ variantId: foreignVariantId, quantity: 1 }] } })).status()).toBe(400);
  const before = (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
  const attempts = await Promise.all([request.post(endpoint, { headers, data: body }), request.post(endpoint, { headers, data: body })]);
  expect(attempts.map((r) => r.status())).toEqual([201, 201]);
  expect((await attempts[0].json()).confirmationPath).toBe((await attempts[1].json()).confirmationPath);
  expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(before - 1);
  const wa = await request.post(endpoint, { headers, data: { ...body, checkoutKey: randomUUID(), paymentMethod: "WHATSAPP", total: 1 } });
  expect(wa.status()).toBe(201);
  const payload = await wa.json();
  expect(new URL(payload.url).hostname).toBe("wa.me");
  expect(new URL(payload.url).searchParams.get("text")).toContain("20.000");
  const token = payload.confirmationPath.split("/").pop();
  expect((await request.get(`/s/${foreignSlug}/pedido/${token}`)).status()).toBe(404);
  expect((await request.post(`/api/store/${foreignSlug}/orders/${token}/payment`, { headers, data: { intent: "demo", status: "PAID" } })).status()).toBe(404);
});
