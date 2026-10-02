import { test, expect, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { randomUUID } from "node:crypto";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: Number(process.env.DATABASE_POOL_MAX ?? 1) }) });
const tag = randomUUID().slice(0, 8);
const superEmail = `super-${tag}@example.invalid`;
const ownerEmail = `duena-${tag}@example.invalid`;
const password = "Clave-segura-QA-2026";
const slug = `qa-nueva-${tag}`;
let leadId: string;

test.beforeAll(async () => {
  await db.user.create({ data: { email: superEmail, name: "BM Dev QA", role: "SUPERADMIN_BMDEV", passwordHash: await bcrypt.hash(password, 10) } });
  const lead = await db.lead.create({
    data: { name: "Ana QA", businessName: `Dulce QA ${tag}`, whatsapp: "1123456789", email: ownerEmail, industry: "Pastelería", sellsOnline: "redes", productCount: "21-100", needs: "nueva", usesMercadoPago: true },
  });
  leadId = lead.id;
});
test.afterAll(async () => {
  await db.lead.deleteMany({ where: { id: leadId } });
  await db.store.deleteMany({ where: { slug: { startsWith: slug } } });
  await db.user.deleteMany({ where: { email: { in: [superEmail, ownerEmail] } } });
  await db.$disconnect();
});

async function login(page: Page, email: string, pass: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(pass);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test("BM Dev turns a request into a live store and the owner can log in", async ({ page }) => {
  await login(page, superEmail, password);
  await expect(page).toHaveURL(/\/superadmin$/);
  await expect(page.getByRole("heading", { name: "Panel BM Dev" })).toBeVisible();

  await page.getByRole("navigation", { name: "Panel BM Dev" }).first().getByRole("link", { name: /Solicitudes/ }).click();
  await page.getByRole("link", { name: new RegExp(`Dulce QA ${tag}`) }).click();
  await expect(page.getByText("Sí, por Instagram / WhatsApp")).toBeVisible();
  const follow = page.getByRole("form", { name: "Seguimiento de la solicitud" });
  await follow.getByLabel("Estado").selectOption("QUALIFIED");
  await follow.getByLabel("Notas internas").fill("Presupuesto enviado por WhatsApp");
  await follow.getByRole("button", { name: "Guardar" }).click();
  await expect(follow.getByRole("status")).toHaveText("Solicitud actualizada.");

  await page.getByRole("link", { name: "Crear tienda desde esta solicitud" }).click();
  const form = page.getByRole("form", { name: "Nueva tienda" });
  await expect(form.getByLabel("Email (para ingresar)")).toHaveValue(ownerEmail);
  await form.getByLabel("Dirección (slug)").fill(slug);
  await form.getByLabel("Plantilla").selectOption("food");
  await form.getByRole("button", { name: "Crear tienda" }).click();
  await expect(form.getByText(`Tienda Dulce QA ${tag} creada en borrador.`)).toBeVisible();
  const tempPassword = (await form.getByTestId("temp-password").textContent())!.trim();
  expect(tempPassword).toHaveLength(14);
  expect((await db.lead.findUniqueOrThrow({ where: { id: leadId } })).status).toBe("WON");

  expect((await page.request.get(`/s/${slug}`)).status()).toBe(404);
  await form.getByRole("link", { name: "Ir a la tienda" }).click();
  const settings = page.getByRole("form", { name: "Estado de la tienda" });
  await settings.getByLabel("Estado").selectOption("ACTIVE");
  await settings.getByRole("button", { name: "Guardar" }).click();
  await expect(settings.getByRole("status")).toHaveText("Tienda actualizada.");
  expect((await page.request.get(`/s/${slug}`)).status()).toBe(200);

  const domain = page.getByRole("form", { name: "Agregar dominio" });
  await domain.getByLabel("Dominio").fill(`https://www.${slug}.com.ar/`);
  await domain.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByText(`www.${slug}.com.ar`, { exact: true })).toBeVisible();

  const mp = page.getByRole("form", { name: "Mercado Pago" });
  await mp.getByLabel("Modo").selectOption("SANDBOX");
  await mp.getByLabel("Public Key").fill("APP_USR-publica-qa-000000000000");
  await mp.getByLabel("Access Token").fill("token-invalido");
  await mp.getByRole("button", { name: "Guardar Mercado Pago" }).click();
  await expect(mp.getByText("Access Token inválida: empieza con APP_USR- o TEST-.").first()).toBeVisible();
  const secret = `APP_USR-${tag}-0000000000000000000000-secreto`;
  await mp.getByLabel("Access Token").fill(secret);
  await mp.getByRole("button", { name: "Guardar Mercado Pago" }).click();
  await expect(mp.getByRole("status")).toHaveText("Mercado Pago en modo prueba (sandbox).");
  await expect(page.getByText("Prueba · token guardado")).toBeVisible();
  await expect(mp.getByLabel("Access Token")).toHaveValue("");
  expect(await page.content()).not.toContain(secret);

  await page.getByRole("button", { name: "Entrar en modo soporte" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Modo soporte BM Dev: los cambios que hagas impactan en esta tienda.")).toBeVisible();
  await expect(page.getByText(`Dulce QA ${tag}`).first()).toBeVisible();
  await page.getByRole("button", { name: "Salir del modo soporte" }).click();
  await expect(page).toHaveURL(/\/superadmin\/tiendas\//);

  await page.getByRole("button", { name: "Salir" }).first().click();
  await login(page, ownerEmail, tempPassword);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(`Dulce QA ${tag}`).first()).toBeVisible();
  await page.goto("/superadmin");
  await expect(page).toHaveURL(/\/admin$/);
});

test("BM Dev restores a demo store after visitors changed it", async ({ page }) => {
  const demo = await db.store.findFirst({ where: { slug: "nido", isDemo: true } });
  test.skip(!demo, "demo stores not seeded");
  await db.store.update({ where: { id: demo!.id }, data: { name: "Nido cambiada por un visitante" } });
  await login(page, superEmail, password);
  await expect(page).toHaveURL(/\/superadmin$/);
  await page.goto(`/superadmin/tiendas/${demo!.id}`);
  const reset = page.getByRole("form", { name: "Restablecer demo" });
  await reset.getByRole("button", { name: "Restablecer demo" }).click();
  await expect(reset.getByText("Confirmá que querés borrar los cambios de la demo.")).toBeVisible();
  await reset.getByLabel("Sí, quiero borrar los cambios de esta demo").check();
  await reset.getByRole("button", { name: "Restablecer demo" }).click();
  await expect(page.getByText("Demo restablecida a su estado original.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Casa Nido" })).toBeVisible();
  await page.goto("/s/nido");
  await expect(page.getByText("Nido cambiada por un visitante")).toHaveCount(0);
});

test("superadmin screens fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, superEmail, password);
  await expect(page).toHaveURL(/\/superadmin$/);
  for (const path of ["/superadmin", "/superadmin/solicitudes", `/superadmin/solicitudes/${leadId}`, "/superadmin/tiendas", "/superadmin/tiendas/nueva"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
  }
});
