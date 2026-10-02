import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStoreBySlug, getStoreOrigin } from "@/lib/store/resolve";
import { storeMetadata } from "@/lib/seo";

const TITLES: Record<string, string> = { envios: "Envíos y retiros", cambios: "Cambios y devoluciones", privacidad: "Privacidad", terminos: "Términos y condiciones" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string; type: string }> }): Promise<Metadata> {
  const { slug, type } = await params;
  const store = await getStoreBySlug(slug);
  if (!store || !TITLES[type]) return { robots: { index: false } };
  return storeMetadata(store, await getStoreOrigin(store), { path: `/politicas/${type}`, title: TITLES[type] });
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string; type: string }> }) {
  const { slug, type } = await params;
  const store = await getStoreBySlug(slug);
  if (!store?.settings) notFound();
  const policies: Record<string, [string, string | null]> = { envios: ["Envíos y retiros", store.settings.shippingPolicy], cambios: ["Cambios y devoluciones", store.settings.returnsPolicy], privacidad: ["Privacidad", store.settings.privacyPolicy], terminos: ["Términos y condiciones", store.settings.termsPolicy] };
  const policy = policies[type];
  if (!policy) notFound();
  return <article className="mx-auto max-w-3xl px-5 py-14"><h1 className="mb-8 font-heading text-3xl">{policy[0]}</h1><div className="whitespace-pre-wrap text-sm leading-7">{policy[1] ?? "Consultá al comercio para conocer su política vigente."}</div></article>;
}
