import "server-only";
import { db } from "@/lib/db";

export type LandingDemo = {
  slug: string;
  name: string;
  industry: string;
  tagline: string | null;
  colors: { primary: string; onPrimary: string; accent: string; bg: string; surface: string; fg: string; muted: string; line: string };
  products: { name: string; price: number; compareAtPrice: number | null; image: string | null }[];
};

// Display order on the landing; demos not listed here go last.
const ORDER = ["alma", "nativa", "mia", "nido", "detalle"];

/** Public data of the demo stores, used to show real examples on the commercial landing. */
export async function getLandingDemos(): Promise<LandingDemo[]> {
  const stores = await db.store.findMany({
    where: { isDemo: true, status: "ACTIVE" },
    select: {
      slug: true,
      name: true,
      industry: true,
      settings: { select: { tagline: true } },
      theme: { select: { primaryColor: true, primaryContrast: true, accentColor: true, backgroundColor: true, surfaceColor: true, textColor: true, mutedColor: true, borderColor: true } },
      products: {
        where: { active: true },
        orderBy: [{ featured: "desc" }, { soldCount: "desc" }, { createdAt: "asc" }],
        take: 4,
        select: { name: true, price: true, compareAtPrice: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
      },
    },
  });
  const rank = (slug: string) => (ORDER.includes(slug) ? ORDER.indexOf(slug) : ORDER.length);
  return stores
    .filter((s) => s.theme)
    .sort((a, b) => rank(a.slug) - rank(b.slug))
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      industry: s.industry,
      tagline: s.settings?.tagline ?? null,
      colors: {
        primary: s.theme!.primaryColor,
        onPrimary: s.theme!.primaryContrast,
        accent: s.theme!.accentColor,
        bg: s.theme!.backgroundColor,
        surface: s.theme!.surfaceColor,
        fg: s.theme!.textColor,
        muted: s.theme!.mutedColor,
        line: s.theme!.borderColor,
      },
      products: s.products.map((p) => ({ name: p.name, price: p.price, compareAtPrice: p.compareAtPrice, image: p.images[0]?.url ?? null })),
    }));
}
