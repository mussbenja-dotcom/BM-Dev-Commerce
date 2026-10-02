import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getStoreBySlug, getStoreBase } from "@/lib/store/resolve";
import { themeStyle } from "@/components/store/theme";
import { StoreProvider } from "@/components/store/store-context";
import { CartProvider } from "@/components/store/cart";
import { StoreHeader } from "@/components/store/header";
import { CartDrawer } from "@/components/store/cart-drawer";
import { getShippingMethods, ARGENTINE_PROVINCES } from "@/lib/services/checkout";
import { whatsappUrl } from "@/lib/whatsapp";

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store?.settings || !store.theme) notFound();
  const [base, shipping] = await Promise.all([getStoreBase(slug), getShippingMethods(store.id)]);
  const s = store.settings;
  const whatsapp = whatsappUrl(s.whatsapp, `Hola ${store.name}, quería hacer una consulta.`);
  return <div style={themeStyle(store.theme)} className="flex min-h-dvh flex-col bg-bg font-body text-fg">
    <StoreProvider value={{ slug, base, name: store.name, whatsapp: s.whatsapp, instagram: s.instagram, freeShippingThreshold: s.freeShippingThreshold, transferDiscountPct: s.transferDiscountPct, maxInstallments: s.maxInstallments, cardStyle: store.theme.cardStyle === "square" ? "square" : "portrait", logoUrl: s.logoUrl }}><CartProvider slug={slug}>
      {s.announcement && <div className="bg-primary px-4 py-2 text-center text-xs tracking-wide text-on-primary">{s.announcement}</div>}
      <StoreHeader categories={store.categories.map(({ slug, name }) => ({ slug, name }))} />
      <main id="contenido" className="flex-1">{children}</main>
      <footer className="mt-16 border-t border-line bg-surface"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:grid-cols-3 lg:px-8"><div><p className="font-heading text-2xl">{store.name}</p><p className="mt-3 max-w-sm text-sm text-muted">{s.footerText ?? s.tagline}</p></div><div className="space-y-3 text-sm"><p className="font-medium">Estamos cerca</p>{s.address && <p>{s.address}{s.city ? `, ${s.city}` : ""}</p>}{s.hours && <p>{s.hours}</p>}{s.email && <a className="block" href={`mailto:${s.email}`}>{s.email}</a>}{s.instagram && <a className="block underline" href={`https://www.instagram.com/${s.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer">Instagram</a>}{whatsapp && <a className="block underline" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}</div><nav aria-label="Información" className="flex flex-col gap-3 text-sm"><Link href={`${base}/politicas/envios`}>Envíos y retiros</Link><Link href={`${base}/politicas/cambios`}>Cambios y devoluciones</Link><Link href={`${base}/politicas/privacidad`}>Privacidad</Link></nav></div><div className="border-t border-line px-5 py-5 text-center text-xs text-muted">© {new Date().getFullYear()} {store.name} · <a href="https://bmdev.solutions" target="_blank" rel="noreferrer">Desarrollado por BM Dev</a></div></footer>
      <CartDrawer shipping={shipping} provinces={ARGENTINE_PROVINCES} />
      {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" aria-label="Consultar por WhatsApp" className="fixed bottom-5 right-5 z-20 rounded-full bg-wa p-4 text-white shadow-lg"><MessageCircle size={25} /></a>}
    </CartProvider></StoreProvider>
  </div>;
}
