import "server-only";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { findSlugByHost, isPlatformHost } from "@/lib/store/resolve";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Which site is being crawled: the BM Dev platform or one store on its own domain. */
export async function crawlTarget(): Promise<{ kind: "platform"; origin: string } | { kind: "store"; origin: string; slug: string }> {
  const host = ((await headers()).get("host") ?? "").toLowerCase();
  if (!host || isPlatformHost(host)) return { kind: "platform", origin: appUrl() };
  const slug = await findSlugByHost(host.split(":")[0]);
  return slug ? { kind: "store", origin: `https://${host}`, slug } : { kind: "platform", origin: appUrl() };
}

const POLICIES = ["envios", "cambios", "privacidad", "terminos"];

/** Public URLs of one ACTIVE, non-demo store under the given origin. */
async function storeEntries(storeId: string, origin: string): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    db.category.findMany({ where: { storeId, active: true }, select: { slug: true, updatedAt: true } }),
    db.product.findMany({ where: { storeId, active: true }, orderBy: { updatedAt: "desc" }, take: 45_000, select: { slug: true, updatedAt: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } }),
  ]);
  return [
    { url: origin || "/", changeFrequency: "daily", priority: 1 },
    { url: `${origin}/productos`, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((c) => ({ url: `${origin}/categorias/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${origin}/productos/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.6, images: p.images.map((i) => i.url) })),
    ...POLICIES.map((t) => ({ url: `${origin}/politicas/${t}`, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}

export async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const target = await crawlTarget();
  if (target.kind === "store") {
    const store = await db.store.findFirst({ where: { slug: target.slug, status: "ACTIVE", isDemo: false }, select: { id: true } });
    return store ? storeEntries(store.id, target.origin) : [];
  }
  const origin = target.origin;
  // Demo stores are fictitious (noindex). Stores with a verified domain are listed on that domain instead.
  const stores = await db.store.findMany({
    where: { status: "ACTIVE", isDemo: false, NOT: { domains: { some: { isPrimary: true, verified: true } } } },
    select: { id: true, slug: true },
  });
  const perStore = await Promise.all(stores.map((s) => storeEntries(s.id, `${origin}/s/${s.slug}`)));
  return [
    { url: `${origin}/tienda-online`, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/demo`, changeFrequency: "monthly", priority: 0.7 },
    ...perStore.flat(),
  ];
}
