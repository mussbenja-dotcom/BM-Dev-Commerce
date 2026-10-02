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

test("merchant configures the store and the storefront reflects it", async ({ page }) => {
  await login(page);
  await page.getByRole("navigation", { name: "Panel" }).first().getByRole("link", { name: "Configuración" }).click();
  await expect(page.getByText("Mercado Pago sin conectar")).toBeVisible();

  const info = page.getByRole("form", { name: "Datos de la tienda" });
  await info.getByLabel("Barra de anuncio (opcional)").fill("Envío gratis QA desde $ 30.000");
  await info.getByRole("button", { name: "Guardar datos" }).click();
  await expect(info.getByRole("status")).toHaveText("Datos de la tienda guardados.");

  const pay = page.getByRole("form", { name: "Medios de pago" });
  for (const name of ["Mercado Pago", "Transferencia bancaria", "Efectivo al retirar", "Pedido por WhatsApp"]) await pay.getByLabel(name).uncheck();
  await pay.getByLabel("Mercado Pago").check();
  await pay.getByRole("button", { name: "Guardar medios de pago" }).click();
  await expect(pay.getByText("Dejá activo al menos un medio de pago que tus clientes puedan usar.").first()).toBeVisible();
  await pay.getByLabel("Transferencia bancaria").check();
  await pay.getByLabel("Alias").fill("tienda.qa");
  await pay.getByLabel("Titular").fill("Dueño QA");
  await pay.getByLabel("CBU / CVU").fill("123");
  await pay.getByRole("button", { name: "Guardar medios de pago" }).click();
  await expect(pay.getByText("Revisá el CBU/CVU: son 22 números.").first()).toBeVisible();
  await pay.getByLabel("CBU / CVU").fill("");
  await pay.getByRole("button", { name: "Guardar medios de pago" }).click();
  await expect(pay.getByRole("status")).toHaveText("Medios de pago guardados.");

  const ship = page.getByRole("form", { name: "Nueva forma de entrega" });
  await ship.getByLabel("Nombre").fill("Moto QA");
  await ship.getByLabel("Costo").fill("2500");
  await ship.getByLabel("CABA").check();
  await ship.getByRole("button", { name: "Crear forma de entrega" }).click();
  await expect(ship.getByRole("status")).toHaveText("Forma de entrega creada.");

  const settings = await db.storeSettings.findUniqueOrThrow({ where: { storeId: storeIds[0] } });
  expect(settings).toMatchObject({ enableMercadoPago: true, enableTransfer: true, enableCash: false, bankAlias: "tienda.qa", bankHolder: "Dueño QA" });
  expect(await db.shippingMethod.findFirst({ where: { storeId: storeIds[0], name: "Moto QA" } })).toMatchObject({ price: 2500, provinces: ["CABA"] });
  expect(await db.storeSettings.findUniqueOrThrow({ where: { storeId: storeIds[1] } })).toMatchObject({ announcement: null, bankAlias: null });

  await page.goto(`/s/${slug}`);
  await expect(page.getByText("Envío gratis QA desde $ 30.000")).toBeVisible();
});

test("demo panel visitors can save settings without touching seeded data", async ({ page }) => {
  test.skip(process.env.DEMO_LOGIN_ENABLED !== "true", "demo login disabled");
  await page.goto("/login");
  await page.getByRole("button", { name: /tienda demo/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/configuracion");
  const pay = page.getByRole("form", { name: "Medios de pago" });
  await expect(page.getByText("MODO DEMO", { exact: true })).toBeVisible();
  await expect(pay.getByLabel("Alias")).toBeDisabled();
  await pay.getByRole("button", { name: "Guardar medios de pago" }).click();
  await expect(pay.getByRole("status")).toHaveText("Medios de pago guardados. En modo demo los datos bancarios no se modifican.");
});

test("merchant duplicates, adjusts stock, publishes a banner and restyles the store", async ({ page }) => {
  const [own] = storeIds;
  const base = await db.product.create({
    data: { storeId: own, slug: "buzo-extra", name: "Buzo Extra QA", description: "Buzo", sku: "BZX", price: 30000, active: true, variants: { create: { storeId: own, sku: "BZX", stock: 4 } } },
  });
  await login(page);
  await page.goto(`/admin/productos/${base.id}`);
  await page.getByRole("button", { name: "Duplicar" }).click();
  await expect(page.getByText("Copia creada, oculta y con stock en 0.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Buzo Extra QA (copia)" })).toBeVisible();

  await page.getByRole("navigation", { name: "Panel" }).first().getByRole("link", { name: "Stock" }).click();
  await page.getByRole("link", { name: "Agotado" }).click();
  await expect(page.getByRole("link", { name: "Buzo Extra QA (copia)" })).toBeVisible();
  await page.getByRole("link", { name: "Todo" }).click();
  const stock = page.getByRole("form", { name: "Ajustar stock de Buzo Extra QA (copia) · Única" });
  await stock.getByLabel("Cantidad").fill("6");
  await stock.getByLabel("Motivo").fill("Ingreso de temporada");
  await stock.getByRole("button", { name: "Ajustar" }).click();
  await expect(stock.getByRole("status")).toHaveText("Stock actualizado: 0 → 6.");
  await expect(page.getByText("Ingreso de temporada").first()).toBeVisible();

  await page.goto("/admin/promociones#banners");
  const banner = page.getByRole("form", { name: "Nuevo banner" });
  await banner.getByLabel("Título").fill("Liquidación QA");
  await banner.getByLabel("Imagen", { exact: true }).fill("https://example.com/foto.jpg");
  await banner.getByRole("button", { name: "Crear banner" }).click();
  await expect(banner.getByText(/Cloudinary o Unsplash/).first()).toBeVisible();
  await banner.getByLabel("Imagen", { exact: true }).fill("https://images.unsplash.com/photo-1434389677669-e08b4cac3105");
  await banner.getByRole("button", { name: "Crear banner" }).click();
  await expect(banner.getByRole("status")).toHaveText("Banner creado.");

  await page.goto("/admin/configuracion#apariencia");
  const look = page.getByRole("form", { name: "Apariencia" });
  await look.getByLabel("Texto", { exact: true }).fill("#f0f0f0");
  await look.getByRole("button", { name: "Guardar apariencia" }).click();
  await expect(look.getByText("El texto no se lee bien sobre ese fondo. Elegí colores con más contraste.").first()).toBeVisible();
  await look.getByLabel("Texto", { exact: true }).fill("#202020");
  await look.getByLabel("Principal (botones)", { exact: true }).fill("#7a2e22");
  await look.getByRole("button", { name: "Guardar apariencia" }).click();
  await expect(look.getByRole("status")).toHaveText("Apariencia guardada.");
  expect(await db.storeTheme.findUniqueOrThrow({ where: { storeId: own } })).toMatchObject({ primaryColor: "#7a2e22", textColor: "#202020", primaryContrast: "#ffffff" });

  await page.goto(`/s/${slug}`);
  await expect(page.getByRole("heading", { name: "Liquidación QA" })).toBeVisible();
  await page.goto(`/s/${slug}/politicas/terminos`);
  await expect(page.getByRole("heading", { name: "Términos y condiciones" })).toBeVisible();
});

test("merchant uploads a product photo that the store serves; demo sessions cannot upload", async ({ page }) => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  const [own] = storeIds;
  const product = await db.product.create({ data: { storeId: own, slug: "foto-qa", name: "Foto QA", description: "x", sku: "FOTO-QA", price: 1000, variants: { create: { storeId: own, sku: "FOTO-QA", stock: 1 } } } });
  await login(page);
  await page.goto(`/admin/productos/${product.id}`);
  const form = page.getByRole("form", { name: "Editar producto" });
  await form.locator('input[type="file"]').setInputFiles({ name: "foto.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg onload=alert(1)></svg>") });
  await expect(form.getByText("Solo se pueden subir fotos JPG, PNG o WebP.")).toBeVisible();
  await form.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await expect(form.getByText("Foto cargada. Guardá para publicarla.")).toBeVisible();
  const url = (await form.getByLabel("Fotos (una por línea)").inputValue()).trim();
  expect(url).toMatch(new RegExp(`^/uploads/${own}/[A-Za-z0-9_-]+\\.png$`));
  await form.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(form.getByText("Producto guardado.")).toBeVisible();
  const served = await page.request.get(url);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/png");
  expect((await db.productImage.findFirstOrThrow({ where: { productId: product.id } })).url).toBe(url);
  await page.goto(`/s/${slug}/productos/foto-qa`);
  await expect(page.locator(`img[src*="${encodeURIComponent(url)}"]`).first()).toBeVisible();

  // Cross-site and demo sessions are refused.
  expect((await page.request.post("/api/admin/uploads", { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: png } }, headers: { Origin: "https://evil.example" } })).status()).toBe(403);
  if (process.env.DEMO_LOGIN_ENABLED === "true") {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByRole("button", { name: /tienda demo/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
    const res = await page.request.post("/api/admin/uploads", { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: png } }, headers: { Origin: "http://localhost:3100" } });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toBe("En modo demo no se pueden subir archivos.");
  }
});

test("product screens fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  for (const path of ["/admin/productos", "/admin/productos/nuevo", "/admin/productos/categorias", "/admin/promociones", "/admin/clientes", "/admin/configuracion", "/admin/stock", "/admin"]) {
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
