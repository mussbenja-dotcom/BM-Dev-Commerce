import Image from "next/image";
import type { CSSProperties } from "react";
import { BarChart3, Boxes, Home, Package, Search, ShoppingBag, Tag, Users } from "lucide-react";
import { formatPrice } from "@/lib/money";
import type { LandingDemo } from "@/lib/services/landing";

/*
 * Illustrative previews built from the real demo data (names, colors,
 * products). They are drawings of the screens, not live iframes, so they stay
 * light and never break the landing if a demo changes.
 */

function themeStyle(demo: LandingDemo): CSSProperties {
  const c = demo.colors;
  return { "--m-primary": c.primary, "--m-on-primary": c.onPrimary, "--m-accent": c.accent, "--m-bg": c.bg, "--m-surface": c.surface, "--m-fg": c.fg, "--m-muted": c.muted, "--m-line": c.line } as CSSProperties;
}

function ProductThumb({ product, sizes }: { product: LandingDemo["products"][number]; sizes: string }) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-[6px] bg-[var(--m-surface)]">
      {product.image ? <Image src={product.image} alt="" fill sizes={sizes} quality={70} className="object-cover" /> : null}
    </div>
  );
}

export function DesktopPreview({ demo, domain = "www.tunegocio.com.ar" }: { demo: LandingDemo; domain?: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_24px_60px_-20px_rgba(17,19,24,0.35)]" style={themeStyle(demo)}>
      <div className="flex items-center gap-2 border-b border-black/10 bg-[#f3f3f1] px-3 py-2">
        <span className="flex gap-1" aria-hidden><i className="size-2.5 rounded-full bg-[#ff5f57]" /><i className="size-2.5 rounded-full bg-[#febc2e]" /><i className="size-2.5 rounded-full bg-[#28c840]" /></span>
        <span className="mx-auto truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-[#555]">{domain}</span>
      </div>
      <div className="bg-[var(--m-bg)] text-[var(--m-fg)]">
        <div className="bg-[var(--m-primary)] py-1 text-center text-[9px] text-[var(--m-on-primary)]">Envío gratis en compras seleccionadas</div>
        <div className="flex items-center justify-between border-b border-[var(--m-line)] px-4 py-2.5">
          <span className="text-sm font-semibold tracking-tight">{demo.name}</span>
          <span className="hidden gap-3 text-[10px] text-[var(--m-muted)] sm:flex"><span>Novedades</span><span>Productos</span><span>Ofertas</span></span>
          <span className="flex gap-2 text-[var(--m-fg)]" aria-hidden><Search size={13} /><ShoppingBag size={13} /></span>
        </div>
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--m-accent)]">{demo.industry}</p>
          <p className="mt-1 max-w-[16rem] text-base font-semibold leading-tight">{demo.tagline ?? demo.name}</p>
          <span className="mt-2 inline-block rounded-[4px] bg-[var(--m-primary)] px-2.5 py-1 text-[10px] text-[var(--m-on-primary)]">Ver productos</span>
        </div>
        <div className="grid grid-cols-4 gap-2.5 px-4 pt-2 pb-4">
          {demo.products.slice(0, 4).map((p) => (
            <div key={p.name} className="min-w-0">
              <ProductThumb product={p} sizes="120px" />
              <p className="mt-1 truncate text-[9px]">{p.name}</p>
              <p className="text-[9px] font-semibold">{formatPrice(p.price)}</p>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">Vista de computadora de la tienda demo {demo.name}</figcaption>
    </figure>
  );
}

export function PhonePreview({ demo, compact = false }: { demo: LandingDemo; compact?: boolean }) {
  return (
    <figure className={`${compact ? "w-[150px] xl:w-[165px]" : "w-[190px]"} shrink-0 rounded-[30px] border-[6px] border-[#111318] bg-[#111318] shadow-[0_24px_60px_-20px_rgba(17,19,24,0.45)]`} style={themeStyle(demo)}>
      <div className="overflow-hidden rounded-[24px] bg-[var(--m-bg)] text-[var(--m-fg)]">
        <div className="mx-auto mt-1.5 h-1.5 w-12 rounded-full bg-[#111318]" aria-hidden />
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="truncate text-xs font-semibold">{demo.name}</span>
          <ShoppingBag size={12} aria-hidden />
        </div>
        <div className="grid grid-cols-2 gap-2 px-3">
          {demo.products.slice(0, 4).map((p) => (
            <div key={p.name} className="min-w-0">
              <ProductThumb product={p} sizes="90px" />
              <p className="mt-1 truncate text-[8px]">{p.name}</p>
              <p className="text-[8px] font-semibold">{formatPrice(p.price)}</p>
            </div>
          ))}
        </div>
        <div className="p-3">
          <span className="block rounded-[6px] bg-[var(--m-primary)] py-1.5 text-center text-[9px] font-medium text-[var(--m-on-primary)]">Agregar al carrito</span>
        </div>
      </div>
      <figcaption className="sr-only">Vista de celular de la tienda demo {demo.name}</figcaption>
    </figure>
  );
}

const SAMPLE_ORDERS = [
  { n: 1048, who: "Lucía M.", status: "Nueva", tone: "bg-sky-100 text-sky-800" },
  { n: 1047, who: "Martín G.", status: "Pagada", tone: "bg-emerald-100 text-emerald-800" },
  { n: 1046, who: "Sofía R.", status: "En preparación", tone: "bg-amber-100 text-amber-800" },
  { n: 1045, who: "Juan P.", status: "Enviada", tone: "bg-violet-100 text-violet-800" },
];

export function AdminPreview({ storeName }: { storeName: string }) {
  const nav = [[Home, "Inicio"], [Package, "Pedidos"], [Boxes, "Productos"], [Tag, "Promociones"], [Users, "Clientes"], [BarChart3, "Ventas"]] as const;
  return (
    <figure className="overflow-hidden rounded-xl border border-black/10 bg-white text-[#15171a] shadow-[0_24px_60px_-20px_rgba(17,19,24,0.35)]">
      <div className="flex">
        <div className="hidden w-28 shrink-0 flex-col gap-1 bg-[#111318] p-3 text-[10px] text-white/70 sm:flex">
          <span className="mb-2 truncate text-[11px] font-semibold text-white">{storeName}</span>
          {nav.map(([Icon, label], i) => (
            <span key={label} className={`flex items-center gap-1.5 rounded px-1.5 py-1 ${i === 1 ? "bg-white/10 text-white" : ""}`}><Icon size={11} aria-hidden />{label}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-3.5">
          <p className="text-xs font-semibold">Pedidos</p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {[["Ventas del mes", "▲ 18 %"], ["Pedidos nuevos", "6"], ["Stock bajo", "3 productos"]].map(([label, value]) => (
              <div key={label} className="rounded-md border border-black/10 p-2">
                <p className="truncate text-[8px] text-[#62666d]">{label}</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-2.5 divide-y divide-black/5 rounded-md border border-black/10">
            {SAMPLE_ORDERS.map((o) => (
              <div key={o.n} className="flex items-center justify-between gap-2 px-2 py-1.5 text-[9px]">
                <span className="font-medium">#{o.n}</span>
                <span className="flex-1 truncate text-[#62666d]">{o.who}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${o.tone}`}>{o.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="sr-only">Vista del panel de administración de la tienda demo</figcaption>
    </figure>
  );
}
