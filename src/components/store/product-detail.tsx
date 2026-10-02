"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart";
import { useHref, useStore } from "./store-context";
import { Modal } from "./modal";
import { Button, buttonClasses } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import { productInquiryMessage, whatsappUrl } from "@/lib/whatsapp";

type Product = {
  name: string; slug: string; description: string; price: number; compareAtPrice: number | null; option1Name: string | null; option2Name: string | null;
  images: { url: string; alt: string | null }[];
  variants: { id: string; option1: string | null; option2: string | null; stock: number; price: number | null }[];
};
export function ProductDetail({ product: p, productUrl }: { product: Product; productUrl: string }) {
  const store = useStore(); const href = useHref(); const cart = useCart(); const router = useRouter();
  const options1 = [...new Set(p.variants.map((v) => v.option1).filter((v): v is string => !!v))];
  const options2 = [...new Set(p.variants.map((v) => v.option2).filter((v): v is string => !!v))];
  const [option1, setOption1] = useState(options1.length === 1 ? options1[0] : "");
  const [option2, setOption2] = useState(options2.length === 1 ? options2[0] : "");
  const [quantity, setQuantity] = useState(1); const [photo, setPhoto] = useState(0); const [zoom, setZoom] = useState(false); const [message, setMessage] = useState("");
  const variant = p.variants.find((v) => (v.option1 ?? "") === option1 && (v.option2 ?? "") === option2);
  const price = variant?.price ?? p.price;
  const label = [option1, option2].filter(Boolean).join(" / ");
  const inquiry = whatsappUrl(store.whatsapp, productInquiryMessage({ name: p.name, variant: label, url: productUrl }));
  const add = (buy: boolean) => {
    if (!variant) return;
    const inCart = cart.items.find((i) => i.variantId === variant.id)?.quantity ?? 0;
    if (quantity + inCart > Math.min(20, variant.stock)) { setMessage(`Ya tenés ${inCart} en el carrito. El máximo disponible es ${Math.min(20, variant.stock)}.`); return; }
    cart.add({ variantId: variant.id, productSlug: p.slug, name: p.name, variantLabel: label || null, image: p.images[0]?.url ?? null, unitPrice: price }, quantity);
    if (buy) router.push(href("/checkout")); else { cart.open(); setMessage("Producto agregado al carrito."); }
  };
  return <div className="grid gap-10 lg:grid-cols-2 lg:gap-16"><div><button onClick={() => setZoom(true)} disabled={!p.images.length} aria-label="Ampliar imagen del producto" className="relative block aspect-[4/5] w-full overflow-hidden rounded-theme bg-surface">{p.images[photo] && <Image src={p.images[photo].url} alt={p.images[photo].alt ?? p.name} fill quality={80} sizes="(max-width: 1024px) 100vw, 50vw" preload className="object-cover" />}</button><div className="mt-3 flex gap-3 overflow-x-auto">{p.images.map((img, i) => <button key={`${img.url}-${i}`} onClick={() => setPhoto(i)} aria-label={`Ver imagen ${i + 1}`} aria-pressed={photo === i} className={`relative h-22 w-18 shrink-0 border-2 ${photo === i ? "border-primary" : "border-transparent"}`}><Image src={img.url} alt="" fill quality={80} sizes="80px" className="object-cover" /></button>)}</div><Modal open={zoom} onClose={() => setZoom(false)} title={p.name}><div className="relative h-[70vh]">{p.images[photo] && <Image src={p.images[photo].url} alt={p.images[photo].alt ?? p.name} fill quality={80} sizes="100vw" className="object-contain" />}</div></Modal></div>
    <div className="lg:py-4"><p className="mb-3 text-xs uppercase tracking-widest text-muted">{store.name}</p><h1 className="font-heading text-3xl sm:text-4xl">{p.name}</h1><p className="mt-6 text-2xl">{formatPrice(price)} {p.compareAtPrice && p.compareAtPrice > price && <del className="ml-3 text-base text-muted">{formatPrice(p.compareAtPrice)}</del>}</p>{store.maxInstallments > 1 && <p className="mt-2 text-sm text-muted">Hasta {store.maxInstallments} cuotas. Condiciones según el medio de pago.</p>}{store.transferDiscountPct > 0 && <p className="mt-2 text-sm">{formatPrice(Math.round(price * (1 - store.transferDiscountPct / 100)))} por transferencia</p>}
      <div className="my-8 space-y-5">{[{ values: options1, name: p.option1Name ?? "Opción", value: option1, set: setOption1 }, { values: options2, name: p.option2Name ?? "Color", value: option2, set: setOption2 }].map((option, i) => option.values.length > 0 && <fieldset key={i}><legend className="mb-3 text-sm font-medium">{option.name}</legend><div className="flex flex-wrap gap-2">{option.values.map((value) => <button key={value} aria-pressed={option.value === value} onClick={() => { option.set(value); setMessage(""); }} className={`min-w-12 rounded-theme border px-4 py-2 text-sm ${option.value === value ? "border-primary bg-primary text-on-primary" : "border-line"}`}>{value}</button>)}</div></fieldset>)}</div>
      <p className="mb-4 text-sm" role="status">{variant ? variant.stock > 0 ? `${variant.stock} disponibles` : "Agotado" : "Elegí las opciones para ver disponibilidad."}</p>
      <label className="mb-5 flex items-center gap-3 text-sm">Cantidad<input type="number" min={1} max={Math.min(20, variant?.stock ?? 20)} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="w-20 border border-line p-2" /></label>
      <div className="grid gap-3"><Button size="lg" onClick={() => add(false)} disabled={!variant || variant.stock < quantity}>Agregar al carrito</Button><Button variant="secondary" size="lg" onClick={() => add(true)} disabled={!variant || variant.stock < quantity}>Comprar ahora</Button>{inquiry && <a href={inquiry} target="_blank" rel="noreferrer" className={buttonClasses("ghost")}>Consultar por WhatsApp</a>}</div>{message && <p role="status" className="mt-4 text-sm">{message}</p>}
      <div className="mt-8 border-t border-line pt-6"><h2 className="mb-3 text-sm font-medium">Sobre este producto</h2><p className="whitespace-pre-wrap text-sm leading-7 text-muted">{p.description}</p></div>
    </div>
  </div>;
}
