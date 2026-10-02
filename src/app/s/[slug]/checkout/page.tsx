import { notFound } from "next/navigation";
import { getStoreBySlug } from "@/lib/store/resolve";
import { getShippingMethods, ARGENTINE_PROVINCES } from "@/lib/services/checkout";
import { CheckoutForm, type PaymentOption } from "@/components/store/checkout-form";

export const metadata = { title: "Finalizar compra", robots: { index: false, follow: false } };
export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ via?: string }> }) {
  const store = await getStoreBySlug((await params).slug);
  if (!store?.settings) notFound();
  const s = store.settings;
  const payments: PaymentOption[] = [];
  if (s.enableMercadoPago && (store.isDemo || (s.mpMode !== "DEMO" && s.mpAccessTokenEnc))) payments.push({ value: "MERCADOPAGO", label: store.isDemo && (s.mpMode === "DEMO" || !s.mpAccessTokenEnc) ? "Mercado Pago · simulación demo" : "Mercado Pago" });
  if (s.enableTransfer) payments.push({ value: "TRANSFER", label: `Transferencia bancaria${s.transferDiscountPct ? ` · ${s.transferDiscountPct}% de descuento` : ""}` });
  if (s.enableCash) payments.push({ value: "CASH", label: "Efectivo" });
  if (s.enableWhatsappOrder && s.whatsapp) payments.push({ value: "WHATSAPP", label: "Coordinar por WhatsApp" });
  return <div className="mx-auto max-w-6xl px-5 py-12"><h1 className="mb-10 font-heading text-3xl">Finalizar compra</h1><CheckoutForm shipping={await getShippingMethods(store.id)} provinces={ARGENTINE_PROVINCES} payments={payments} viaWhatsapp={(await searchParams).via === "whatsapp"} /></div>;
}
