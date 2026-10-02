import { test, expect, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { TEMPLATES } from "../../src/lib/templates";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: Number(process.env.DATABASE_POOL_MAX ?? 1) }) });
const email = `catalog-${randomUUID()}@example.invalid`;
const password = "Clave-segura-QA-2026";
const storeIds: string[] = [];
let slug: string;
let foreignProductId: string;

test.beforeAll(async () => {
  slug = `qa-catalog-${randomUUID()}`;
  const theme = { ...TEMPLATES.fashion.theme, template: "fashion" };
  const store = await db.store.create({ data: { slug, name: "Catálogo QA", industry: "Moda", template: "fashion", status: "ACTIVE", settings: { create: {} }, theme: { create: theme } } });
  storeIds.push(store.id);
  await db.user.create({ data: { email, name: "Dueño QA", passwordHash: await bcrypt.hash(password, 10), role: "STORE_OWNER", storeId: store.id } });
  const other = await db.store.create({ data: { slug: `${slug}-other`, name: "Otra QA", industry: "Moda", template: "fashion", status: "ACTIVE", settings: { create: {} } } });
  storeIds.push(other.id);
  const foreign = await db.product.create({ data: { storeId: other.id, slug: "ajeno", name: "Producto ajeno", description: "x", sku: "AJ-1", price: 1000, variants: { create: { storeId: other.id, sku: "AJ-1", stock: 3 } } } });
  foreignProductId = foreign.id;
});
test.afterAll(async () => {
  await db.store.deleteMany({ where: { id: { in: storeIds } } });
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("merchant manages categories, products, variants and stock", async ({ page }) => {
  await login(page);
  await page.getByRole("navigation", { name: "Panel" }).first().getByRole("link", { name: "Productos" }).click();
  await expect(page.getByText("Todavía no cargaste productos")).toBeVisible();

  await page.getByRole("link", { name: "Categorías" }).click();
  const newCategory = page.getByRole("form", { name: "Nueva categoría" });
  await newCategory.getByLabel("Nombre").fill("Remeras QA");
  await newCategory.getByRole("button", { name: "Crear categoría" }).click();
  await expect(newCategory.getByRole("status")).toHaveText("Categoría creada.");
  await expect(page.getByText("Remeras QA", { exact: true })).toBeVisible();

  await page.goto("/admin/productos/nuevo");
  const form = page.getByRole("form", { name: "Nuevo producto" });
  await form.getByLabel("Nombre").fill("Remera Panel QA");
  await form.getByLabel("Descripción", { exact: true }).fill("Remera de algodón");
  await form.getByLabel("Categoría").selectOption({ label: "Remeras QA" });
  await form.getByLabel("Precio de venta").fill("20.000");
  await form.getByLabel("Precio anterior (opcional)").fill("15000");
  await form.getByLabel("SKU (código interno)").fill("rem panel");
  await form.getByLabel("Stock inicial").fill("5");
  await form.getByLabel("Opción 1 (ej. Talle)").fill("Talle");
  await form.getByRole("button", { name: "Crear producto" }).click();
  await expect(form.getByText("El precio anterior tiene que ser mayor al precio de venta.").first()).toBeVisible();
  await expect(form.getByLabel("Nombre")).toHaveValue("Remera Panel QA");
  await form.getByLabel("Precio anterior (opcional)").fill("25000");
  await form.getByRole("button", { name: "Crear producto" }).click();
  await expect(page).toHaveURL(/\/admin\/productos\/[^/]+\?creado=1$/);
  await expect(page.getByRole("heading", { name: "Remera Panel QA" })).toBeVisible();
  await expect(page.getByText("REM-PANEL · $ 20.000", { exact: true })).toBeVisible();

  await page.locator("summary", { hasText: "Agregar variante" }).click();
  const variantForm = page.getByRole("form", { name: "Nueva variante" });
  await variantForm.getByLabel("Talle").fill("L");
  await variantForm.getByLabel("Stock inicial").fill("2");
  await variantForm.getByRole("button", { name: "Agregar variante" }).click();
  await expect(variantForm.getByRole("status")).toHaveText("Variante agregada.");
  await expect(page.getByText("REM-PANEL-2 · $ 20.000", { exact: true })).toBeVisible();

  const stock = page.getByRole("form", { name: "Ajustar stock de Única" });
  await stock.getByLabel("Tipo de ajuste").selectOption("remove");
  await stock.getByLabel("Cantidad").fill("10");
  await stock.getByRole("button", { name: "Ajustar" }).click();
  await expect(stock.getByRole("alert")).toHaveText("No podés descontar más de lo que hay en stock (5).");
  await stock.getByLabel("Tipo de ajuste").selectOption("add");
  await stock.getByLabel("Cantidad").fill("3");
  await stock.getByLabel("Motivo").fill("Ingreso QA");
  await stock.getByRole("button", { name: "Ajustar" }).click();
  await expect(stock.getByRole("status")).toHaveText("Stock actualizado: 5 → 8.");
  await expect(page.getByText("8 en stock")).toBeVisible();
  await expect(page.getByText("Ingreso QA")).toBeVisible();

  const productSlug = await db.product.findFirstOrThrow({ where: { name: "Remera Panel QA" }, select: { slug: true } });
  expect((await page.request.get(`/s/${slug}/productos/${productSlug.slug}`)).status()).toBe(200);
  await page.getByRole("button", { name: "Ocultar de la tienda" }).click();
  await expect(page.getByText("Producto oculto de la tienda.")).toBeVisible();
  expect((await page.request.get(`/s/${slug}/productos/${productSlug.slug}`)).status()).toBe(404);

  await page.goto("/admin/productos?estado=inactive");
  await expect(page.getByRole("link", { name: /Remera Panel QA/ })).toBeVisible();
  expect((await page.goto(`/admin/productos/${foreignProductId}`))?.status()).toBe(404);
});

test("merchant creates, validates and pauses a coupon", async ({ page }) => {
  await login(page);
  await page.getByRole("navigation", { name: "Panel" }).first().getByRole("link", { name: "Promociones" }).click();
  const form = page.getByRole("form", { name: "Nuevo cupón" });
  await form.getByLabel("Código").fill("qa 20");
  await form.getByLabel("Porcentaje de descuento").fill("150");
  await form.getByRole("button", { name: "Crear cupón" }).click();
  await expect(form.getByText("Ingresá un porcentaje entre 1 y 100.").first()).toBeVisible();
  await expect(form.getByLabel("Código")).toHaveValue("qa 20");
  await form.getByLabel("Porcentaje de descuento").fill("20");
  await form.getByLabel("Límite de usos (opcional)").fill("50");
  await form.getByRole("button", { name: "Crear cupón" }).click();
  await expect(form.getByRole("status")).toHaveText("Cupón QA20 creado.");
  const row = page.locator("details", { hasText: "QA20" });
  await expect(row).toContainText("20 % de descuento");
  await expect(row).toContainText("0 / 50 usos");
  await expect(row).toContainText("Vigente");
  await row.locator("summary").click();
  await row.getByRole("button", { name: "Pausar" }).click();
  await expect(row.getByRole("status").first()).toHaveText("Cupón pausado.");
  await page.reload();
  await expect(page.locator("details", { hasText: "QA20" })).toContainText("Pausado");
  const saved = await db.coupon.findFirstOrThrow({ where: { storeId: storeIds[0], code: "QA20" } });
  expect(saved).toMatchObject({ type: "PERCENT", value: 20, maxUses: 50, active: false });
});

test("merchant reviews customers and exports them", async ({ page }) => {
  const [own, other] = storeIds;
  await db.customer.create({ data: { storeId: own, email: "cliente.qa@example.invalid", firstName: "Carla", lastName: "Cliente", phone: "1155550101", ordersCount: 2, totalSpent: 45000 } });
  const foreign = await db.customer.create({ data: { storeId: other, email: "ajeno.qa@example.invalid", firstName: "Ajeno", lastName: "QA", ordersCount: 1, totalSpent: 1000 } });
  await login(page);
  await page.getByRole("navigation", { name: "Panel" }).first().getByRole("link", { name: "Clientes" }).click();
  await expect(page.getByText("1 clientes · $ 45.000 comprados en total.", { exact: false })).toBeVisible();
  await expect(page.getByText("Ajeno QA")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar CSV" }).click();
  const file = await (await download).path();
  const csv = (await import("node:fs")).readFileSync(file, "utf8");
  expect(csv).toContain("Carla;Cliente;cliente.qa@example.invalid;1155550101;2;45000");
  expect(csv).not.toContain("Ajeno");
  await page.getByRole("link", { name: /Carla Cliente/ }).click();
  await expect(page.getByRole("heading", { name: "Carla Cliente" })).toBeVisible();
  await expect(page.getByText("$ 22.500")).toBeVisible();
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /wa\.me\/5491155550101/);
  expect((await page.goto(`/admin/clientes/${foreign.id}`))?.status()).toBe(404);
});

test("product screens fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  for (const path of ["/admin/productos", "/admin/productos/nuevo", "/admin/productos/categorias", "/admin/promociones", "/admin/clientes"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
  const product = await db.product.findFirst({ where: { storeId: storeIds[0] }, select: { id: true } });
  if (product) {
    await page.goto(`/admin/productos/${product.id}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: "test-results/manual/admin-product-390.png", fullPage: true });
  }
});
