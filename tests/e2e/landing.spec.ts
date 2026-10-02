import { test, expect } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { randomUUID } from "node:crypto";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: Number(process.env.DATABASE_POOL_MAX ?? 1) }) });
const businessName = `Negocio QA ${randomUUID()}`;

test.afterAll(async () => {
  await db.lead.deleteMany({ where: { businessName } });
  await db.$disconnect();
});

test("landing explains the offer at / and /tienda-online without prices or tech talk", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  for (const path of ["/", "/tienda-online"]) {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: "Tu tienda online, hecha para tu negocio." })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/tienda-online$/);
  }
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/next\.?js|prisma|postgres|\bapi\b|react|tailwind/i);
  expect(text).toContain("Sin comisión de BM Dev por venta");
  for (const section of ["Qué incluye", "Cómo funciona", "Conocé cómo podría verse tu tienda", "Contanos qué necesitás", "Empezá a vender con tu propia tienda online."]) {
    await expect(page.getByText(section, { exact: true }).first()).toBeVisible();
  }
  // No catalog/cart of its own: demo links go to the storefronts.
  await expect(page.getByRole("link", { name: "Ver demo", exact: true }).first()).toHaveAttribute("href", "/demo");

  const number = (process.env.BMDEV_WHATSAPP ?? "").replace(/\D/g, "");
  if (number.length >= 8) {
    const href = await page.locator('a[href^="https://wa.me/"]').first().getAttribute("href");
    const url = new URL(href!);
    expect(url.pathname).toBe(`/${number}`);
    expect(url.searchParams.get("text")).toContain("me interesa tener una tienda online para mi negocio");
  }
  expect(errors).toEqual([]);
});

test("demo page lets a prospect browse a store and open its panel", async ({ page }) => {
  test.skip(!(await db.store.count({ where: { slug: "nativa", isDemo: true } })), "demo stores not seeded");
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/demo?rubro=nativa");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Probá una tienda real");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expect(page.getByRole("link", { name: "Ver tienda" })).toHaveAttribute("href", "/s/nativa");
  await expect(page.getByText("BIENVENIDA10").first()).toBeVisible();
  // Every link in the tour is real.
  const hrefs = await page.locator("#recorrido ~ div a, section[aria-labelledby=recorrido] a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(hrefs.length).toBeGreaterThanOrEqual(6);
  for (const href of new Set(hrefs)) expect((await page.request.get(href)).status(), href).toBe(200);
  if (process.env.DEMO_LOGIN_ENABLED === "true") {
    await page.getByRole("button", { name: "Ver panel del negocio" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Nativa Skin").first()).toBeVisible();
  }
});

test("lead form validates on the server, keeps input and stores the request", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tienda-online#solicitud");
  const form = page.getByRole("form", { name: "Solicitar mi tienda online" });
  await form.getByRole("button", { name: "Quiero mi tienda online" }).click();
  await expect(form.getByRole("alert").first()).toContainText("Revisá los datos marcados.");
  await expect(form.getByText("Ingresá tu nombre.")).toBeVisible();

  await form.getByLabel("Nombre", { exact: true }).fill("Ana QA");
  await form.getByLabel("Nombre del negocio").fill(businessName);
  await form.getByLabel("WhatsApp").fill("11 2345 6789");
  await form.getByLabel("Email").fill("no-es-un-email");
  await form.getByLabel("Instagram (opcional)").fill("@negocio.qa");
  await form.getByLabel("Rubro").selectOption("Pastelería");
  await form.getByLabel("¿Actualmente vendés online?").selectOption("redes");
  await form.getByLabel("Cantidad aproximada de productos").selectOption("21-100");
  await form.getByLabel("¿Qué necesitás?").selectOption("nueva");
  await form.getByRole("group", { name: /Usás Mercado Pago/ }).getByLabel("Sí").check();
  await form.getByRole("button", { name: "Quiero mi tienda online" }).click();
  await expect(form.getByText("Ingresá un email válido.")).toBeVisible();
  await expect(form.getByLabel("Nombre del negocio")).toHaveValue(businessName);
  expect(await db.lead.count({ where: { businessName } })).toBe(0);

  await form.getByLabel("Email").fill("ana.qa@example.invalid");
  await form.getByRole("button", { name: "Quiero mi tienda online" }).click();
  await expect(page.getByRole("status")).toContainText("¡Gracias! Recibimos tu solicitud.");
  const lead = await db.lead.findFirstOrThrow({ where: { businessName } });
  expect(lead).toMatchObject({ name: "Ana QA", whatsapp: "1123456789", email: "ana.qa@example.invalid", instagram: "negocio.qa", industry: "Pastelería", usesMercadoPago: true, hasDomain: null, status: "NEW" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("honeypot submissions look successful but are not stored", async ({ page }) => {
  await page.goto("/tienda-online#solicitud");
  const form = page.getByRole("form", { name: "Solicitar mi tienda online" });
  await form.getByLabel("Nombre", { exact: true }).fill("Bot");
  await form.getByLabel("Nombre del negocio").fill(businessName);
  await form.getByLabel("WhatsApp").fill("11 2345 6789");
  await form.getByLabel("Email").fill("bot@example.invalid");
  await form.getByLabel("Rubro").selectOption("Moda");
  await form.getByLabel("¿Actualmente vendés online?").selectOption("no");
  await form.getByLabel("Cantidad aproximada de productos").selectOption("hasta-20");
  await form.getByLabel("¿Qué necesitás?").selectOption("nueva");
  await page.locator('input[name="sitio_web"]').fill("https://spam.example", { force: true });
  await form.getByRole("button", { name: "Quiero mi tienda online" }).click();
  await expect(page.getByRole("status")).toContainText("Recibimos tu solicitud");
  expect(await db.lead.count({ where: { businessName, email: "bot@example.invalid" } })).toBe(0);
});
