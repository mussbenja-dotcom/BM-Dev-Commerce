import type { Metadata } from "next";

/** Serializes JSON-LD safely inside a <script> (no "</script>" breakouts). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

type StoreSeo = { name: string; isDemo: boolean; settings: { seoTitle: string | null; seoDescription: string | null; description: string | null; tagline: string | null; logoUrl: string | null } | null };

const clip = (s: string | null | undefined, max: number) => (s ? (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s) : undefined);

/**
 * Metadata for a storefront page. Demo stores are fictitious and stay out of
 * search results (noindex), but remain shareable.
 */
export function storeMetadata(store: StoreSeo, origin: string, page: { path: string; title?: string; description?: string | null; image?: string | null; type?: "website" | "article" }): Metadata {
  const description = clip(page.description ?? store.settings?.seoDescription ?? store.settings?.description ?? store.settings?.tagline, 160);
  const title = page.title ? `${page.title} | ${store.name}` : store.settings?.seoTitle ?? store.name;
  const url = `${origin}${page.path}`;
  const image = page.image ?? store.settings?.logoUrl ?? undefined;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: page.type ?? "website", url, siteName: store.name, locale: "es_AR", title, description, images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
    robots: store.isDemo ? { index: false, follow: true } : undefined,
  };
}
