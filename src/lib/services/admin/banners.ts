import "server-only";
import { db } from "@/lib/db";
import { AdminError } from "./common";
import type { Actor } from "./orders";

export type BannerInput = {
  placement: "hero" | "promo";
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  position: number;
  active: boolean;
};

/** Store-relative link ("/productos?oferta=1"); the storefront prefixes the store base. */
export function isStorePath(v: string): boolean {
  return /^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/.test(v) && !v.includes("..");
}

export async function listBanners(storeId: string) {
  return db.banner.findMany({ where: { storeId }, orderBy: [{ placement: "asc" }, { position: "asc" }, { createdAt: "asc" }] });
}

export async function saveBanner(actor: Actor, bannerId: string | null, input: BannerInput) {
  if (input.ctaHref && !isStorePath(input.ctaHref)) throw new AdminError("El link tiene que ser una sección de tu tienda, ej. /productos?oferta=1.", { ctaHref: "Usá una ruta de tu tienda que empiece con /." });
  if (bannerId) {
    const r = await db.banner.updateMany({ where: { id: bannerId, storeId: actor.storeId }, data: input });
    if (!r.count) throw new AdminError("No encontramos el banner.");
    return { id: bannerId };
  }
  return db.banner.create({ data: { ...input, storeId: actor.storeId }, select: { id: true } });
}
