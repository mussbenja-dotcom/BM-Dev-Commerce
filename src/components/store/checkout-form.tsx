"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useCart, useQuote } from "./cart";
import { useHref, useStore } from "./store-context";
import { QuoteSummary, type ShippingOption } from "./cart-drawer";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

export type PaymentOption = { value: "MERCADOPAGO" | "TRANSFER" | "CASH" | "WHATSAPP"; label: string };
export function CheckoutForm({ shipping, provinces, payments, viaWhatsapp }: { shipping: ShippingOption[]; provinces: readonly string[]; payments: PaymentOption[]; viaWhatsapp: boolean }) {
  const cart = useCart(); const store = useStore(); const href = useHref();
  const [province, setProvince] = useState("");
  const [delivery, setDelivery] = useState(shipping.some((s) => s.type === "SHIPPING") ? "SHIPPING" : "PICKUP");
  const [shippingId, setShippingId] = useState("");
  const [payment, setPayment] = useState(viaWhatsapp && payments.some((p) => p.value === "WHATSAPP") ? "WHATSAPP" : payments[0]?.value ?? "");
  const [submitting, setSubmitting] = useState(false); const [error, setError] = useState("");
  const attempt = useRef<{ body: string; key: string } | null>(null); const busy = useRef(false);
  const eligible = shipping.filter((s) => s.type === delivery && (s.type === "PICKUP" || (province && (!s.provinces.length || s.provinces.includes(province)))));
  const selected = eligible.find((s) => s.id === shippingId) ?? (eligible.length === 1 ? eligible[0] : undefined);
  const { quote, loading, error: quoteError } = useQuote(store.slug, cart.items, cart.coupon, { shippingMethodId: selected?.id, paymentMethod: payment });
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setSubmitting(true); setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const body = JSON.stringify({ ...form, lines: cart.items.map(({ variantId, quantity }) => ({ variantId, quantity })), couponCode: cart.coupon, deliveryMethod: delivery, shippingMethodId: selected?.id, paymentMethod: payment });
    const storageKey = `bm_checkout_${store.slug}`;
    try {
    if (!attempt.current || attempt.current.body !== body) attempt.current = { body, key: crypto.randomUUID() };
    // Persist only a hash of the request in sessionStorage below; never store the buyer's address.
    const hashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    const hash = Array.from(new Uint8Array(hashBytes), (v) => v.toString(16).padStart(2, "0")).join("");
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as { hash?: string; key?: string } | null;
      if (saved?.hash === hash && saved.key) attempt.current.key = saved.key;
      sessionStorage.setItem(storageKey, JSON.stringify({ hash, key: attempt.current.key }));
    } catch { /* In-memory idempotency still protects repeat submits. */ }
      const response = await fetch(`/api/store/${store.slug}/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...JSON.parse(body), checkoutKey: attempt.current.key }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No pudimos crear el pedido.");
      cart.clear();
      try { sessionStorage.removeItem(storageKey); } catch { /* Optional storage. */ }
      // All local destinations use this store's base, including on a custom domain.
      const localPrefix = `/s/${store.slug}`;
      const destination = String(result.url ?? result.confirmationPath);
      if (destination.startsWith("https://wa.me/")) window.history.replaceState(null, "", href(String(result.confirmationPath).slice(localPrefix.length)));
      window.location.assign(destination.startsWith(localPrefix) ? href(destination.slice(localPrefix.length)) : destination);
    } catch (err) { setError(err instanceof Error ? err.message : "Error de conexión. Reintentá para recuperar tu pedido."); }
    finally { busy.current = false; setSubmitting(false); }
  }
  if (!cart.hydrated) return <p role="status">Cargando tu carrito…</p>;
  if (!cart.items.length) return <div className="py-14 text-center"><p>Tu carrito está vacío.</p><Link className="mt-4 inline-block underline" href={href("/productos")}>Elegir productos</Link></div>;
  return <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_380px]">
    <div className="space-y-9"><section><h2 className="mb-5 font-heading text-xl">1. Tus datos</h2><div className="grid gap-4 sm:grid-cols-2">{[{ name: "firstName", label: "Nombre", auto: "given-name" }, { name: "lastName", label: "Apellido", auto: "family-name" }, { name: "email", label: "Email", auto: "email", type: "email" }, { name: "phone", label: "Teléfono", auto: "tel", type: "tel" }].map((f) => <Field key={f.name} label={f.label}>{(props) => <Input {...props} name={f.name} type={f.type ?? "text"} autoComplete={f.auto} required maxLength={f.name === "email" ? 120 : 60} />}</Field>)}</div></section>
      <section><h2 className="mb-5 font-heading text-xl">2. Entrega</h2><div className="mb-5 flex gap-6">{["SHIPPING", "PICKUP"].filter((type) => shipping.some((s) => s.type === type)).map((type) => <label key={type} className="flex items-center gap-2 text-sm"><input type="radio" name="delivery" value={type} checked={delivery === type} onChange={() => { setDelivery(type); setShippingId(""); }} />{type === "SHIPPING" ? "Envío a domicilio" : "Retiro en el local"}</label>)}</div>
        {delivery === "SHIPPING" && <div className="mb-5 grid gap-4 sm:grid-cols-2"><Field label="Provincia">{(props) => <Select {...props} name="province" required value={province} onChange={(e) => { setProvince(e.target.value); setShippingId(""); }}><option value="">Elegí tu provincia</option>{provinces.map((p) => <option key={p}>{p}</option>)}</Select>}</Field><Field label="Ciudad">{(props) => <Input {...props} name="city" autoComplete="address-level2" required maxLength={80} />}</Field><Field label="Calle, número y departamento">{(props) => <Input {...props} name="street" autoComplete="street-address" required maxLength={120} />}</Field><Field label="Código postal">{(props) => <Input {...props} name="postalCode" autoComplete="postal-code" required maxLength={10} />}</Field></div>}
        <Field label={delivery === "PICKUP" ? "Punto de retiro" : "Método de envío"}>{(props) => <Select {...props} required value={selected?.id ?? ""} onChange={(e) => setShippingId(e.target.value)}><option value="">Elegí una opción</option>{eligible.map((s) => <option key={s.id} value={s.id}>{s.name}{s.estimatedDays ? ` · ${s.estimatedDays}` : ""}</option>)}</Select>}</Field>{province && delivery === "SHIPPING" && !eligible.length && <p className="mt-3 text-sm text-red-700">No hay envíos disponibles a esa provincia.</p>}{selected?.description && <p className="mt-3 text-sm text-muted">{selected.description}</p>}
      </section>
      <section><h2 className="mb-5 font-heading text-xl">3. Pago</h2><div className="space-y-3">{payments.map((p) => <label key={p.value} className="flex items-center gap-3 rounded-theme border border-line p-4 text-sm"><input type="radio" name="payment" required value={p.value} checked={payment === p.value} onChange={() => setPayment(p.value)} />{p.label}</label>)}</div>{!payments.length && <p role="alert">El comercio no tiene medios de pago disponibles.</p>}</section>
      <Field label="Notas para el comercio (opcional)">{(props) => <Textarea {...props} name="notes" maxLength={500} />}</Field>
    </div>
    <aside className="h-fit space-y-5 rounded-theme border border-line bg-surface p-6 lg:sticky lg:top-5"><h2 className="font-heading text-xl">Tu pedido</h2><ul className="space-y-3 text-sm">{cart.items.map((item) => <li key={item.variantId}>{item.quantity} × {item.name}<span className="block text-xs text-muted">{item.variantLabel}</span></li>)}</ul><div className="flex gap-2"><input aria-label="Cupón de descuento" placeholder="Cupón de descuento" value={cart.coupon ?? ""} onChange={(e) => cart.setCoupon(e.target.value)} className="w-full border border-line bg-bg p-3 text-sm" /></div>{quote && <QuoteSummary quote={quote} shippingSelected={!!selected} />}{(loading || !quote) && <p role="status" className="text-sm">Actualizando total…</p>}{quote?.couponError && <p role="alert" className="text-sm text-red-700">{quote.couponError}</p>}{!!quote?.issues.length && <p role="alert" className="text-sm text-red-700">El stock cambió. Revisá las cantidades del carrito antes de continuar.</p>}{(error || quoteError) && <p role="alert" className="text-sm text-red-700">{error || quoteError}</p>}<Button type="submit" size="lg" className="w-full" disabled={submitting || loading || !quote || !!quote.issues.length || !!quote.couponError || !!quoteError || !selected || !payment}>{submitting ? "Confirmando…" : payment === "WHATSAPP" ? "Confirmar y abrir WhatsApp" : "Confirmar pedido"}</Button><button type="button" className="w-full text-center text-sm underline" onClick={cart.open}>Revisar carrito</button><p className="text-xs leading-5 text-muted">Al confirmar aceptás las <Link className="underline" href={href("/politicas/envios")}>condiciones de envío</Link> y la <Link className="underline" href={href("/politicas/privacidad")}>política de privacidad</Link>.</p></aside>
  </form>;
}
