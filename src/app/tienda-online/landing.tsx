import type { Metadata } from "next";
import { connection } from "next/server";
import { bmdevWhatsappUrl } from "@/lib/bmdev";
import { getLandingDemos, type LandingDemo } from "@/lib/services/landing";
import { LandingPage } from "@/components/landing/landing-page";

const title = "Tiendas online personalizadas para tu negocio | BM Dev E-commerce";
const description = "Creamos tiendas online personalizadas para emprendimientos y comercios: tu marca, tu dominio, tus productos y tu propio panel. Mercado Pago, transferencia y WhatsApp. Sin comisión de BM Dev por venta.";

export const landingMetadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/tienda-online" },
  openGraph: { type: "website", url: "/tienda-online", siteName: "BM Dev E-commerce", locale: "es_AR", title, description },
};

/** Shared by /tienda-online and the platform home (/). */
export async function Landing() {
  await connection();
  let demos: LandingDemo[] = [];
  try {
    demos = await getLandingDemos();
  } catch (error) {
    // The landing must keep converting even if the demos cannot be loaded.
    console.error("[landing] could not load demos", error);
  }
  return <LandingPage demos={demos} whatsappUrl={bmdevWhatsappUrl()} demoLoginEnabled={process.env.DEMO_LOGIN_ENABLED === "true"} />;
}
