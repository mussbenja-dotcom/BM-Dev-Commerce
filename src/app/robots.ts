import type { MetadataRoute } from "next";
import { crawlTarget } from "@/lib/services/sitemap";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const target = await crawlTarget();
  const prefix = target.kind === "platform" ? "/s/*" : "";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin", "/superadmin", "/login", "/api/",
        `${prefix}/checkout`, `${prefix}/pedido/`, `${prefix}/pago/`,
      ],
    },
    sitemap: `${target.origin}/sitemap.xml`,
  };
}
