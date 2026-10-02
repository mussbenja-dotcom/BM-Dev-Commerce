import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export const STORE_HOST_HEADER = "x-bm-store-host";

/** Full storefront context for a slug. Only ACTIVE stores are public. */
export const getStoreBySlug = cache(async (slug: string) => {
  const store = await db.store.findUnique({
    where: { slug },
    include: {
      settings: true,
      theme: true,
      domains: { where: { isPrimary: true }, take: 1 },
      categories: { where: { active: true }, orderBy: { position: "asc" } },
    },
  });
  if (!store || store.status !== "ACTIVE" || !store.settings || !store.theme) return null;
  return store;
});

export type StoreContext = NonNullable<Awaited<ReturnType<typeof getStoreBySlug>>>;

/**
 * Base path for links inside a storefront. On a custom domain the proxy
 * rewrites "/" → "/s/[slug]" so links must be root-relative ("").
 */
export async function getStoreBase(slug: string): Promise<string> {
  const h = await headers();
  return h.get(STORE_HOST_HEADER) ? "" : `/s/${slug}`;
}

/** Absolute origin used for canonical URLs, sitemaps and OG tags. */
export async function getStoreOrigin(store: StoreContext): Promise<string> {
  const h = await headers();
  const customHost = h.get(STORE_HOST_HEADER);
  if (customHost) return `https://${customHost}`;
  const primary = store.domains[0]?.hostname;
  if (primary && primary.includes(".") && store.domains[0]?.verified) return `https://${primary}`;
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/s/${store.slug}`;
}

// ---- Host → slug lookup for the proxy (in-memory TTL cache). ----
const hostCache = new Map<string, { slug: string | null; at: number }>();
const HOST_TTL = 60_000;

export async function findSlugByHost(hostname: string): Promise<string | null> {
  const key = hostname.toLowerCase().replace(/^www\./, "");
  const hit = hostCache.get(key);
  if (hit && Date.now() - hit.at < HOST_TTL) return hit.slug;
  const domain = await db.storeDomain.findFirst({
    where: { hostname: { in: [key, `www.${key}`] }, store: { status: "ACTIVE" } },
    select: { store: { select: { slug: true } } },
  });
  const slug = domain?.store.slug ?? null;
  hostCache.set(key, { slug, at: Date.now() });
  return slug;
}

export function isPlatformHost(host: string): boolean {
  const list = (process.env.PLATFORM_HOSTS ?? "localhost:3000,localhost")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const h = host.toLowerCase();
  return list.includes(h) || h.endsWith(".onrender.com") || h.endsWith(".vercel.app");
}
