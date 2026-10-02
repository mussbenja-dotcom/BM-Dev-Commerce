import { notFound } from "next/navigation";
import { getStoreBySlug } from "@/lib/store/resolve";

export default async function PolicyPage({ params }: { params: Promise<{ slug: string; type: string }> }) {
  const { slug, type } = await params;
  const store = await getStoreBySlug(slug);
  if (!store?.settings) notFound();
  const policies: Record<string, [string, string | null]> = { envios: ["Envíos y retiros", store.settings.shippingPolicy], cambios: ["Cambios y devoluciones", store.settings.returnsPolicy], privacidad: ["Privacidad", store.settings.privacyPolicy] };
  const policy = policies[type];
  if (!policy) notFound();
  return <article className="mx-auto max-w-3xl px-5 py-14"><h1 className="mb-8 font-heading text-3xl">{policy[0]}</h1><div className="whitespace-pre-wrap text-sm leading-7">{policy[1] ?? "Consultá al comercio para conocer su política vigente."}</div></article>;
}
