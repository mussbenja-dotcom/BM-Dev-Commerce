import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getStoreBySlug, getStoreBase } from "@/lib/store/resolve";
import { PaymentControls } from "@/components/store/payment-controls";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Simulador de pago demo", robots: { index: false, follow: false } };
export default async function DemoPaymentPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const store = await getStoreBySlug(slug);
  if (!store?.isDemo || !store.settings?.enableMercadoPago || (store.settings.mpMode !== "DEMO" && store.settings.mpAccessTokenEnc)) notFound();
  const order = await db.order.findFirst({ where: { storeId: store.id, publicToken: token, paymentMethod: "MERCADOPAGO" } });
  if (!order) notFound();
  const base = await getStoreBase(slug);
  if (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED" || order.status === "CANCELLED") redirect(`${base}/pedido/${token}`);
  return <section className="mx-auto max-w-lg px-5 py-16"><p className="mb-3 text-xs uppercase tracking-widest text-accent">Modo demostración</p><h1 className="font-heading text-3xl">Probá el pago de tu pedido</h1><p className="my-5 text-sm leading-6 text-muted">Esta simulación no cobra dinero ni solicita datos de tarjeta. Elegí un resultado para ver cómo se actualiza el pedido.</p><p className="mb-6 border-y border-line py-5">Pedido #{order.number} · <strong>{formatPrice(order.total)}</strong></p><PaymentControls token={token} demo /><Link href={`${base}/pedido/${token}`} className="mt-6 block text-center text-sm underline">Volver al pedido</Link></section>;
}
