"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Search, ShoppingBag } from "lucide-react";
import { useStore, useHref } from "./store-context";
import { useCart } from "./cart";
import { Modal } from "./modal";
import { formatPrice } from "@/lib/money";

type Suggestion = { slug: string; name: string; price: number };
export function StoreHeader({ categories }: { categories: { slug: string; name: string }[] }) {
  const store = useStore();
  const href = useHref();
  const cart = useCart();
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ term: string; items: Suggestion[] }>({ term: "", items: [] });
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/store/${store.slug}/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (response.ok) setSuggestions({ term: query, items: await response.json() });
      } catch { /* Search form remains usable when suggestions are unavailable. */ }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, store.slug]);
  const links = <><Link href={href("/productos")} onClick={() => setMenu(false)}>Todos los productos</Link>{categories.map((c) => <Link key={c.slug} href={href(`/categorias/${c.slug}`)} onClick={() => setMenu(false)}>{c.name}</Link>)}<Link href={href("/productos?oferta=1")} onClick={() => setMenu(false)}>Ofertas</Link></>;
  return <header className="relative z-20 border-b border-line bg-bg">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-8">
      <button className="p-2 lg:hidden" onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu /></button>
      <Link href={href("/")} className="font-heading text-2xl font-semibold tracking-widest sm:text-3xl">{store.logoUrl ? <Image src={store.logoUrl} alt={store.name} width={160} height={50} quality={80} className="h-12 w-auto object-contain" /> : store.name}</Link>
      <form action={href("/productos")} className="relative order-last w-full lg:order-none lg:max-w-sm" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
        <div className="flex border-b border-line"><input aria-label="Buscar productos" name="q" value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setFocused(true)} onKeyDown={(e) => { if (e.key === "Escape") setFocused(false); }} placeholder="Buscá algo que te encante" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" autoComplete="off" /><button aria-label="Buscar" className="px-2"><Search size={20} /></button></div>
        {focused && query.length >= 2 && suggestions.term === query && suggestions.items.length > 0 && <ul aria-label="Sugerencias de búsqueda" className="absolute inset-x-0 top-full border border-line bg-bg p-2 shadow-lg">{suggestions.items.map((p) => <li key={p.slug}><Link onClick={() => setFocused(false)} href={href(`/productos/${p.slug}`)} className="flex justify-between gap-3 p-3 text-sm hover:bg-surface"><span>{p.name}</span><span>{formatPrice(p.price)}</span></Link></li>)}</ul>}
      </form>
      <button onClick={cart.open} aria-label={`Abrir carrito, ${cart.count} productos`} className="flex items-center gap-2 p-2"><ShoppingBag size={23} /><span className="text-sm">({cart.count})</span></button>
    </div>
    <nav aria-label="Categorías" className="mx-auto hidden max-w-7xl justify-center gap-7 px-8 pb-5 text-sm lg:flex">{links}</nav>
    <Modal open={menu} onClose={() => setMenu(false)} title="Menú" drawer><nav className="flex flex-col gap-5">{links}</nav></Modal>
  </header>;
}
