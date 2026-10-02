import { test, expect } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: Number(process.env.DATABASE_POOL_MAX ?? 1) }) });
test.afterAll(async () => { await db.$disconnect(); });

/** The 19-step sales meeting from /demo, on the seeded Alma store, at phone width. */
test("sales meeting tour works end to end on the Alma demo", async ({ page }) => {
  test.skip(process.env.DEMO_LOGIN_ENABLED !== "true", "demo login disabled");
  const store = await db.store.findFirst({ where: { slug: "alma", isDemo: true } });
  test.skip(!store, "demo stores not seeded");
  const variant = await db.productVariant.findFirstOrThrow({
    where: { storeId: store!.id, active: true, stock: { gte: 2 }, option1: { not: null }, product: { active: true, option1Name: { not: null } } },
    orderBy: { stock: "desc" },
    include: { product: true },
  });
  await page.setViewportSize({ width: 390, height: 844 });

  // 1-4: home, category, search, filters.
  await page.goto("/s/alma");
  await expect(page.getByRole("link", { name: /Alma Store/i }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "Buscar productos" }).fill(variant.product.name.split(" ")[0]);
  await expect(page.getByRole("list", { name: "Sugerencias de búsqueda" })).toBeVisible();
  await page.goto("/s/alma/productos?stock=1&orden=precio-asc");
  await expect(page.getByTestId("product-card").first()).toBeVisible();

  // 5-7: product, variant, cart.
  await page.goto(`/s/alma/productos/${variant.product.slug}`);
  await page.getByRole("button", { name: variant.option1!, exact: true }).click();
  if (variant.option2) await page.getByRole("button", { name: variant.option2, exact: true }).click();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("dialog", { name: "Tu carrito" })).toBeVisible();
  await page.getByRole("link", { name: "Iniciar compra" }).click();

  // 8-11: coupon, shipping, checkout, WhatsApp order.
  await page.getByLabel("Nombre", { exact: true }).fill("Cliente");
  await page.getByLabel("Apellido", { exact: true }).fill("Reunión");
  await page.getByLabel("Email", { exact: true }).fill("reunion@example.invalid");
  await page.getByLabel("Teléfono", { exact: true }).fill("1155550000");
  await page.getByLabel("Provincia", { exact: true }).selectOption("CABA");
  await page.getByLabel("Ciudad", { exact: true }).fill("Buenos Aires");
  await page.getByLabel("Calle, número y departamento").fill("Gorriti 4870");
  await page.getByLabel("Código postal").fill("1414");
  await page.getByLabel("Método de envío").selectOption({ index: 1 });
  await page.getByRole("textbox", { name: "Cupón de descuento" }).fill("BIENVENIDA10");
  await page.getByRole("radio", { name: "Coordinar por WhatsApp" }).check();
  let waUrl = "";
  await page.route("https://wa.me/**", (route) => { waUrl = route.request().url(); return route.fulfill({ body: "<p>WhatsApp</p>", contentType: "text/html" }); });
  await expect(page.getByRole("button", { name: "Confirmar y abrir WhatsApp" })).toBeEnabled();
  await page.getByRole("button", { name: "Confirmar y abrir WhatsApp" }).click();
  await page.waitForURL(/^https:\/\/wa\.me\//);
  expect(waUrl).toContain("https://wa.me/");
  const order = await db.order.findFirstOrThrow({ where: { storeId: store!.id, email: "reunion@example.invalid" }, orderBy: { createdAt: "desc" } });
  expect(order).toMatchObject({ paymentMethod: "WHATSAPP", couponCode: "BIENVENIDA10", status: "NEW" });
  expect(order.discountTotal).toBeGreaterThan(0);
  expect(decodeURIComponent(waUrl)).toContain(`#${order.number}`);
  expect((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(variant.stock - 1);

  // 13-16: panel, order, status, stock.
  await page.goto("/login");
  await page.getByRole("button", { name: /tienda demo/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/pedidos/${order.id}`);
  await expect(page.getByRole("heading", { name: `Pedido #${order.number}` })).toBeVisible();
  await page.getByLabel("Nuevo estado").selectOption("PREPARING");
  await page.getByRole("button", { name: "Actualizar" }).click();
  await expect(page.getByText(`Pedido #${order.number} actualizado.`)).toBeVisible();
  await page.goto(`/admin/stock?q=${encodeURIComponent(variant.sku)}`);
  await expect(page.getByText(`${variant.stock - 1} en stock`).first()).toBeVisible();

  // 17-19: product, promotion, metrics screens open.
  await page.goto(`/admin/productos/${variant.productId}`);
  await expect(page.getByRole("heading", { name: variant.product.name })).toBeVisible();
  await page.goto("/admin/promociones");
  await expect(page.getByRole("form", { name: "Nuevo cupón" })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByText("Últimos 30 días")).toBeVisible();

  // Leave the demo as it was: cancelling restores stock and the coupon use.
  await page.goto(`/admin/pedidos/${order.id}`);
  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await page.getByRole("button", { name: "Confirmar cancelación" }).click();
  await expect(page.getByText("Cancelado", { exact: true }).first()).toBeVisible();
  await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
  expect((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(variant.stock);
});
