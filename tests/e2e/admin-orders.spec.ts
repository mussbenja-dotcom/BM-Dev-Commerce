import { test, expect, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { randomUUID } from "node:crypto";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: Number(process.env.DATABASE_POOL_MAX ?? 1) }) });
const email = `owner-${randomUUID()}@example.invalid`;
const password = "Clave-segura-QA-2026";
const storeIds: string[] = [];
let variantId: string;
let orderId: string;
let foreignOrderId: string;

async function seedStore(label: string, withOwner: boolean) {
  const store = await db.store.create({
    data: { slug: `qa-admin-${label}-${randomUUID()}`, name: `Panel QA ${label}`, industry: "Moda", template: "fashion", status: "ACTIVE", settings: { create: {} } },
  });
  storeIds.push(store.id);
  if (withOwner) {
    await db.user.create({ data: { email, name: "Dueña QA", passwordHash: await bcrypt.hash(password, 10), role: "STORE_OWNER", storeId: store.id } });
  }
  const product = await db.product.create({
    data: {
      storeId: store.id, slug: "buzo", name: "Buzo QA", description: "Fixture", sku: `BZ-${label}`, price: 15000,
      variants: { create: { storeId: store.id, sku: `BZ-${label}-M`, option1: "M", stock: 8, lowStockAlert: 3 } },
    },
    include: { variants: true },
  });
  const variant = product.variants[0];
  const order = await db.order.create({
    data: {
      storeId: store.id, number: 1001, publicToken: randomUUID(), paymentMethod: "TRANSFER", deliveryMethod: "PICKUP",
      firstName: "Lucía", lastName: label === "own" ? "Compradora" : "Ajena", email: "lucia@example.invalid", phone: "1155550000",
      subtotal: 30000, total: 30000,
      items: { create: { storeId: store.id, productId: product.id, variantId: variant.id, productName: "Buzo QA", variantLabel: "M", sku: variant.sku, unitPrice: 15000, quantity: 2, lineTotal: 30000 } },
      events: { create: { storeId: store.id, type: "created", message: "Pedido recibido desde la tienda online" } },
    },
  });
  await db.productVariant.update({ where: { id: variant.id }, data: { stock: 6 } });
  return { variantId: variant.id, orderId: order.id };
}

test.beforeAll(async () => {
  ({ variantId, orderId } = await seedStore("own", true));
  ({ orderId: foreignOrderId } = await seedStore("other", false));
});
test.afterAll(async () => {
  for (const id of storeIds) await db.store.delete({ where: { id } });
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
});

async function login(page: Page) {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("merchant manages an order end to end and cannot see another store", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);

  await expect(page.getByRole("heading", { name: "Hola, Dueña" })).toBeVisible();
  await expect(page.getByText("Ventas del mes")).toBeVisible();
  await expect(page.getByText("$ 30.000").first()).toBeVisible();
  await page.screenshot({ path: "test-results/manual/admin-dashboard-1280.png", fullPage: true });

  await page.getByRole("navigation", { name: "Panel" }).first().getByRole("link", { name: /Pedidos/ }).click();
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  await expect(page.getByText("Lucía Compradora")).toBeVisible();
  await expect(page.getByText("Lucía Ajena")).toHaveCount(0);

  await page.getByPlaceholder("Número, nombre, email o teléfono").fill("inexistente");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("No hay pedidos para mostrar")).toBeVisible();
  await page.getByRole("link", { name: "Quitar filtros" }).click();

  await page.getByRole("link", { name: "#1001" }).click();
  await expect(page.getByRole("heading", { name: "Pedido #1001" })).toBeVisible();

  await page.getByRole("button", { name: "Marcar como pagado" }).click();
  await expect(page.getByText("Pago del pedido #1001 actualizado.")).toBeVisible();
  await expect(page.getByText("Pagado").first()).toBeVisible();

  await page.getByLabel("Nuevo estado").selectOption("PREPARING");
  await page.getByRole("button", { name: "Actualizar" }).click();
  await expect(page.getByText("Pedido #1001 actualizado.")).toBeVisible();
  await expect(page.getByText("Estado: Confirmado → Preparando")).toBeVisible();

  await page.getByPlaceholder(/nota interna/).fill("Envolver para regalo");
  await page.getByRole("button", { name: "Agregar nota" }).click();
  await expect(page.locator("ol").getByText("Envolver para regalo")).toBeVisible();

  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await page.getByLabel("Motivo (opcional)").fill("Sin talle");
  // Paid order: the browser blocks submission until the refund is acknowledged.
  await page.getByRole("button", { name: "Confirmar cancelación" }).click();
  expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PREPARING");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirmar cancelación" }).click();
  await expect(page.getByText("Pedido cancelado con pago acreditado")).toBeVisible();
  await expect(page.getByText(/Motivo: Sin talle/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0);

  expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(8);
  expect(await db.stockMovement.count({ where: { orderId, reason: "CANCEL_RESTOCK" } })).toBe(1);

  await page.getByRole("button", { name: "Marcar como reintegrado" }).click();
  await expect(page.getByText("Reintegrado").first()).toBeVisible();

  const foreign = await page.goto(`/admin/pedidos/${foreignOrderId}`);
  expect(foreign?.status()).toBe(404);
  expect(errors).toEqual([]);
});

test("orders panel works on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/admin/pedidos");
  await expect(page.getByRole("link", { name: /#1001 · Lucía Compradora/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/manual/admin-orders-390.png", fullPage: true });
  await page.goto(`/admin/pedidos/${orderId}`);
  await expect(page.getByRole("heading", { name: "Pedido #1001" })).toBeVisible();
  await page.screenshot({ path: "test-results/manual/admin-order-detail-390.png", fullPage: true });
});
