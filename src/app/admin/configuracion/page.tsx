import type { Metadata } from "next";
import { requireStoreSession } from "@/lib/auth/session";
import { getStoreSettings } from "@/lib/services/admin/settings";
import { ARGENTINE_PROVINCES } from "@/lib/services/checkout";
import { formatPrice } from "@/lib/money";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { ContactForm, FreeShippingForm, PaymentsForm, PoliciesForm, ShippingMethodForm, StoreInfoForm } from "@/components/admin/settings-forms";
import { Badge } from "@/components/ui/badge";
import { Disclosure } from "@/components/admin/form-kit";

export const metadata: Metadata = { title: "Configuración" };

const SECTIONS = [["tienda", "Tienda"], ["contacto", "Contacto"], ["pagos", "Pagos"], ["envios", "Envíos"], ["politicas", "Políticas"]] as const;

export default async function SettingsPage() {
  const session = await requireStoreSession();
  const { store, settings: s, mercadoPago, shippingMethods } = await getStoreSettings(session.storeId);
  const v = (x: string | number | null | undefined) => (x === null || x === undefined ? "" : String(x));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Configuración" description="Cómo se ve tu tienda, cómo te contactan, cómo cobrás y cómo entregás." />
      <nav aria-label="Secciones de configuración" className="-mx-4 mb-6 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex w-max gap-1 rounded-xl border border-line bg-bg p-1 text-sm">
          {SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`} className="flex h-8 items-center rounded-lg px-3 text-muted hover:text-fg">{label}</a></li>)}
        </ul>
      </nav>

      <div className="flex flex-col gap-6">
        <section id="tienda" className="scroll-mt-28">
          <Panel title="Tienda"><div className="p-4 sm:p-5">
            <StoreInfoForm values={{ name: store.name, tagline: v(s?.tagline), description: v(s?.description), announcement: v(s?.announcement), footerText: v(s?.footerText), logoUrl: v(s?.logoUrl), faviconUrl: v(s?.faviconUrl), seoTitle: v(s?.seoTitle), seoDescription: v(s?.seoDescription) }} />
          </div></Panel>
        </section>

        <section id="contacto" className="scroll-mt-28">
          <Panel title="Contacto"><div className="p-4 sm:p-5">
            <ContactForm provinces={ARGENTINE_PROVINCES} values={{ whatsapp: v(s?.whatsapp), email: v(s?.email), phone: v(s?.phone), instagram: v(s?.instagram), facebook: v(s?.facebook), tiktok: v(s?.tiktok), address: v(s?.address), city: v(s?.city), province: v(s?.province), hours: v(s?.hours) }} />
          </div></Panel>
        </section>

        <section id="pagos" className="scroll-mt-28">
          <Panel title="Pagos" action={<Badge tone={mercadoPago.available ? "green" : "amber"}>{store.isDemo ? "Mercado Pago demo" : mercadoPago.available ? "Mercado Pago conectado" : "Mercado Pago sin conectar"}</Badge>}>
            <div className="p-4 sm:p-5">
              <PaymentsForm
                mercadoPago={{ available: mercadoPago.available, demo: store.isDemo }}
                flags={{ enableMercadoPago: s?.enableMercadoPago ?? false, enableTransfer: s?.enableTransfer ?? false, enableCash: s?.enableCash ?? false, enableWhatsappOrder: s?.enableWhatsappOrder ?? false }}
                values={{ transferDiscountPct: v(s?.transferDiscountPct ?? 0), maxInstallments: v(s?.maxInstallments ?? 1), bankName: v(s?.bankName), bankHolder: v(s?.bankHolder), bankAlias: v(s?.bankAlias), bankCbu: v(s?.bankCbu), bankCuit: v(s?.bankCuit) }}
              />
            </div>
          </Panel>
        </section>

        <section id="envios" className="scroll-mt-28">
          <Panel title="Envíos y retiro">
            <div className="border-b border-line p-4 sm:p-5"><FreeShippingForm value={v(s?.freeShippingThreshold)} /></div>
            <ul className="divide-y divide-line">
              {shippingMethods.map((m) => (
                <li key={m.id}>
                  <details className="px-4 py-3 sm:px-5">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        <span className="font-medium">{m.name}</span>
                        <span className="block text-xs text-muted">
                          {m.type === "PICKUP" ? "Retiro" : m.provinces.length ? m.provinces.join(", ") : "Todo el país"}
                          {m.estimatedDays ? ` · ${m.estimatedDays}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {!m.active ? <Badge tone="neutral">No disponible</Badge> : null}
                        <span className="font-medium tabular-nums">{m.price ? formatPrice(m.price) : "Gratis"}</span>
                      </span>
                    </summary>
                    <div className="mt-4">
                      <ShippingMethodForm provinces={ARGENTINE_PROVINCES} method={{ id: m.id, name: m.name, description: v(m.description), type: m.type, price: String(m.price), provinces: m.provinces, estimatedDays: v(m.estimatedDays), active: m.active, position: String(m.position) }} />
                    </div>
                  </details>
                </li>
              ))}
              <li key="new">
                <Disclosure className="px-4 py-3 sm:px-5" initiallyOpen={!shippingMethods.length} summary={<summary className="cursor-pointer text-sm font-medium">Agregar forma de entrega</summary>}>
                  <div className="mt-4">
                    <ShippingMethodForm provinces={ARGENTINE_PROVINCES} method={{ name: "", description: "", type: "SHIPPING", price: "", provinces: [], estimatedDays: "", active: true, position: String(shippingMethods.length) }} />
                  </div>
                </Disclosure>
              </li>
            </ul>
          </Panel>
        </section>

        <section id="politicas" className="scroll-mt-28">
          <Panel title="Políticas"><div className="p-4 sm:p-5">
            <PoliciesForm values={{ shippingPolicy: v(s?.shippingPolicy), returnsPolicy: v(s?.returnsPolicy), privacyPolicy: v(s?.privacyPolicy) }} />
          </div></Panel>
        </section>
      </div>
    </div>
  );
}
