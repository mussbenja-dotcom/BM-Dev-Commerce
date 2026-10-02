import { test, expect } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { TEMPLATES } from "../../src/lib/templates";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: Number(process.env.DATABASE_POOL_MAX ?? 1) }) });
const tag = randomUUID().slice(0, 8);
const slug = `qa-seo-${tag}`;
const domain = `qa-seo-${tag}.com.ar`;
const storeIds: string[] = [];

test.beforeAll(async () => {
  for (const [s, d] of [[slug, undefined], [`${slug}-dom`, domain]] as const) {
    const st = await db.store.create({
      data: {
        slug: s, name: `SEO ${s}`, industry: "Moda", template: "fashion", status: "ACTIVE",
        settings: { create: { description: "Ropa de prueba para SEO", instagram: "seo.qa" } }, theme: { create: { ...TEMPLATES.fashion.theme, template: "fashion" } },
        domains: d ? { create: { hostname: d, isPrimary: true, verified: true } } : undefined,
      },
    });
    storeIds.push(st.id);
    await db.category.create({ data: { storeId: st.id, slug: "remeras", name: "Remeras" } });
    await db.product.create({ data: { storeId: st.id, slug: "remera-seo", name: "Remera <SEO>", description: "Algodón", sku: `SEO-${s}`, price: 12000, brand: "QA", variants: { create: { storeId: st.id, sku: `SEO-${s}-1`, stock: 3 } } } });
  }
});
test.afterAll(async () => {
  await db.store.deleteMany({ where: { id: { in: storeIds } } });
  await db.$disconnect();
});

test("platform robots and sitemap list the landing and stores without their own domain", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  for (const line of ["Disallow: /admin", "Disallow: /superadmin", "Disallow: /s/*/checkout", "Sitemap: http://localhost:3100/sitemap.xml"]) expect(robots).toContain(line);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("http://localhost:3100/tienda-online");
  expect(sitemap).toContain("http://localhost:3100/demo");
  expect(sitemap).toContain(`http://localhost:3100/s/${slug}/productos/remera-seo`);
  expect(sitemap).toContain(`http://localhost:3100/s/${slug}/categorias/remeras`);
  expect(sitemap).not.toContain(`/s/${slug}-dom/`);
  expect(sitemap).not.toContain("/s/alma");
});

test("a store's own domain gets its own robots and sitemap", async ({ request }) => {
  const headers = { host: domain };
  const robots = await (await request.get("/robots.txt", { headers })).text();
  expect(robots).toContain(`Sitemap: https://${domain}/sitemap.xml`);
  expect(robots).toContain("Disallow: /checkout");
  const sitemap = await (await request.get("/sitemap.xml", { headers })).text();
  expect(sitemap).toContain(`https://${domain}/productos/remera-seo`);
  expect(sitemap).not.toContain("tienda-online");
  expect(sitemap).not.toContain(`/s/${slug}/`);
});

test("product pages carry canonical, Open Graph and safe JSON-LD; demo stores are noindex", async ({ page }) => {
  await page.goto(`/s/${slug}/productos/remera-seo`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `http://localhost:3100/s/${slug}/productos/remera-seo`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", `Remera <SEO> | SEO ${slug}`);
  expect(await page.locator('meta[name="robots"]').count()).toBe(0);
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const data = blocks.flatMap((b) => JSON.parse(b));
  const product = data.find((d: { "@type": string }) => d["@type"] === "Product");
  expect(product).toMatchObject({ name: "Remera <SEO>", sku: `SEO-${slug}`, brand: { name: "QA" }, offers: { priceCurrency: "ARS", lowPrice: 12000, availability: "https://schema.org/InStock" } });
  expect(data.some((d: { "@type": string }) => d["@type"] === "BreadcrumbList")).toBe(true);
  expect(blocks.join("")).not.toContain("<SEO>");

  if (await db.store.count({ where: { slug: "alma", isDemo: true } })) {
    await page.goto("/s/alma");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
  await page.goto("/tienda-online");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /tienda-online\/opengraph-image/);
  expect((await page.request.get("/tienda-online/opengraph-image")).headers()["content-type"]).toContain("image/png");
});
