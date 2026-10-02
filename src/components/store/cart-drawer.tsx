"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart, useQuote } from "./cart";
import { useHref, useStore } from "./store-context";
import { Modal } from "./modal";
import { Button, buttonClasses } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import type { Quote } from "@/lib/pricing";

export type ShippingOption = { id: string; name: string; description: string | null; type: "SHIPPING" | "PICKUP"; price: number; provinces: string[]; estimatedDays: string | null };
export function QuoteSummary({ quote, shippingSelected = true }: { quote: Quote; shippingSelected?: boolean }) {
  return <dl className="space-y-3 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(quote.subtotal)}</dd></div>{quote.couponDiscount > 0 && <div className="flex justify-between"><dt>Cupón {quote.couponCode}</dt><dd>−{formatPrice(quote.couponDiscount)}</dd></div>}{quote.paymentDiscount > 0 && <div className="flex justify-between"><dt>Descuento por transferencia</dt><dd>−{formatPrice(quote.paymentDiscount)}</dd></div>}<div className="flex justify-between"><dt>Envío / retiro</dt><dd>{shippingSelected ? formatPrice(quote.shippingTotal) : "A calcular"}</dd></div><div className="flex justify-between border-t border-line pt-4 text-lg font-semibold"><dt>{shippingSelected ? "Total" : "Total sin envío"}</dt><dd>{formatPrice(quote.total)}</dd></div></dl>;
}

export function CartDrawer({ shipping, provinces }: { shipping: ShippingOption[]; provinces: readonly string[] }) {
  const cart = useCart();
  const store = useStore();
  const href = useHref();
  const [province, setProvince] = useState("");
  const [shippingId, setShippingId] = useState("");
  const eligible = shipping.filter((s) => s.type === "PICKUP" || (province && (!s.provinces.length || s.provinces.includes(province))));
  const selected = eligible.find((s) => s.id === shippingId);
  const { quote, loading, error } = useQuote(store.slug, cart.items, cart.coupon, { shippingMethodId: selected?.id, enabled: cart.isOpen });
  return <Modal title="Tu carrito" open={cart.isOpen} onClose={cart.close} drawer>
    {!cart.items.length ? <div className="space-y-5 py-10 text-center"><p>Tu carrito está esperando algo especial.</p><Link href={href("/productos")} onClick={cart.close} className={buttonClasses()}>Explorar productos</Link></div> : <div className="space-y-6">
      <ul className="space-y-5">{cart.items.map((item) => <li key={item.variantId} className="flex gap-4">{item.image && <Image src={item.image} alt="" width={76} height={96} quality={80} className="h-24 w-19 rounded-theme object-cover" />}<div className="min-w-0 flex-1"><Link onClick={cart.close} href={href(`/productos/${item.productSlug}`)} className="text-sm font-medium">{item.name}</Link><p className="text-xs text-muted">{item.variantLabel}</p><div className="mt-3 flex items-center justify-between gap-2"><label className="text-xs">Cantidad <input aria-label={`Cantidad de ${item.name}`} type="number" min={1} max={20} value={item.quantity} onChange={(e) => cart.setQuantity(item.variantId, Math.max(1, Number(e.target.value) || 1))} className="ml-2 w-14 border border-line p-1" /></label><button className="text-xs underline" onClick={() => cart.remove(item.variantId)}>Eliminar</button></div>{quote?.issues.some((i) => i.variantId === item.variantId) && <p className="mt-2 text-xs text-red-700" role="alert">Stock insuficiente. Ajustá la cantidad o eliminá el producto.</p>}</div></li>)}</ul>
      <form onSubmit={(e) => { e.preventDefault(); cart.setCoupon(String(new FormData(e.currentTarget).get("coupon"))); }} className="flex gap-2"><input name="coupon" aria-label="Cupón de descuento" placeholder="Cupón de descuento" defaultValue={cart.coupon ?? ""} className="min-w-0 flex-1 border border-line px-3 text-sm" /><Button type="submit" variant="secondary">Aplicar</Button></form>
      {cart.coupon && <button onClick={() => cart.setCoupon(null)} className="text-sm underline">Quitar cupón {cart.coupon}</button>}
      {quote?.couponError && <p role="alert" className="text-sm text-red-700">{quote.couponError}</p>}
      <div className="space-y-3"><label className="block text-sm">Estimar envío<select aria-label="Provincia para estimar envío" value={province} onChange={(e) => { setProvince(e.target.value); setShippingId(""); }} className="mt-2 w-full border border-line bg-bg p-3"><option value="">Elegí tu provincia</option>{provinces.map((p) => <option key={p}>{p}</option>)}</select></label><select aria-label="Método para estimar envío" value={selected?.id ?? ""} onChange={(e) => setShippingId(e.target.value)} className="w-full border border-line bg-bg p-3 text-sm"><option value="">Elegí envío o retiro</option>{eligible.map((s) => <option value={s.id} key={s.id}>{s.name} · {formatPrice(s.price)}</option>)}</select></div>
      {quote && <>{store.freeShippingThreshold && <div className="space-y-2 text-xs"><p>{quote.freeShippingByThreshold || quote.freeShippingByCoupon ? "¡Tu envío es gratis!" : `Te faltan ${formatPrice(quote.amountToFreeShipping ?? 0)} para envío gratis.`}</p><progress aria-label="Progreso hacia envío gratis" className="h-1.5 w-full accent-current" max={store.freeShippingThreshold} value={quote.freeShippingByCoupon ? store.freeShippingThreshold : quote.subtotal - quote.couponDiscount} /></div>}<QuoteSummary quote={quote} shippingSelected={!!selected} /></>}
      {loading && <p role="status" className="text-sm">Actualizando precios…</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="grid gap-3"><Link onClick={cart.close} href={href("/checkout")} className={buttonClasses()}>Iniciar compra</Link>{store.whatsapp && <Link onClick={cart.close} href={href("/checkout?via=whatsapp")} className={buttonClasses("secondary")}>Pedir por WhatsApp</Link>}</div>
    </div>}
  </Modal>;
}
