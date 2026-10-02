import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, LayoutDashboard, Store } from "lucide-react";
import { demoLoginAction } from "@/lib/auth/actions";
import { bmdevWhatsappUrl } from "@/lib/bmdev";
import { getDemoTour, getLandingDemos, type LandingDemo } from "@/lib/services/landing";
import { buttonClasses } from "@/components/ui/button";
import { AdminPreview, DesktopPreview, PhonePreview } from "@/components/landing/previews";

export const metadata: Metadata = {
  title: { absolute: "Demo en vivo | BM Dev E-commerce" },
  description: "Probá una tienda online real hecha con BM Dev E-commerce: comprá como cliente y administrala como comercio, con datos de ejemplo.",
  alternates: { canonical: "/demo" },
};

const BRAND = { "--c-primary": "#c43e0c", "--c-on-primary": "#ffffff", "--c-accent": "#e8551f", "--c-fg": "#111318", "--c-surface": "#f5f4f1", "--c-line": "#e5e3de", "--c-muted": "#5b6068" } as React.CSSProperties;

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ rubro?: string }> }) {
  await connection();
  const { rubro } = await searchParams;
  let demos: LandingDemo[] = [];
  try {
    demos = await getLandingDemos();
  } catch (error) {
    console.error("[demo] could not load demos", error);
  }
  const current = demos.find((d) => d.slug === rubro) ?? demos[0];
  const tour = current ? await getDemoTour(current.slug) : null;
  const demoLogin = process.env.DEMO_LOGIN_ENABLED === "true";
  const whatsapp = bmdevWhatsappUrl();
  const s = (path = "") => `/s/${current?.slug}${path}`;

  const shopSteps: [string, string | null, string][] = tour ? [
    ["Inicio de la tienda", s(), "Portada, categorías, destacados y beneficios con la marca del comercio."],
    ["Una categoría", tour.category ? s(`/categorias/${tour.category.slug}`) : s("/productos"), tour.category ? `Abrí “${tour.category.name}”.` : "Abrí el catálogo."],
    ["Buscar", tour.searchTerm ? s(`/productos?q=${encodeURIComponent(tour.searchTerm)}`) : s("/productos"), `Escribí “${tour.searchTerm || "remera"}” en el buscador: aparecen sugerencias.`],
    ["Filtrar y ordenar", s("/productos?stock=1&orden=precio-asc"), "En el celular, “Filtrar y ordenar” abre el panel de filtros."],
    ["Ficha de producto", tour.product ? s(`/productos/${tour.product.slug}`) : s("/productos"), tour.product ? `${tour.product.name}: galería con zoom, cuotas y relacionados.` : "Galería, cuotas y relacionados."],
    ["Elegir variante", null, tour.product?.option1Name ? `Elegí ${[tour.product.option1Name, tour.product.option2Name].filter(Boolean).join(" y ").toLowerCase()}: las combinaciones sin stock no se pueden agregar.` : "Elegí la variante disponible."],
    ["Agregar al carrito", null, "Se abre el carrito con la cantidad y la variante elegida."],
    ["Aplicar un cupón", null, tour.coupons.length ? `Probá ${tour.coupons.map((c) => c.code).join(", ")}.` : "Probá un cupón de la tienda."],
    ["Calcular el envío", null, "Elegí la provincia: se ve el costo y cuánto falta para el envío gratis."],
    ["Checkout", s("/checkout"), "Datos, envío o retiro, y medio de pago. Los importes los calcula el servidor."],
    ["Pedido por WhatsApp", null, "Con “Coordinar por WhatsApp” el pedido queda registrado y se abre el mensaje armado."],
    ["Simular el pago", null, "Con Mercado Pago (demo) elegí aprobado, pendiente o rechazado. No se cobra dinero real."],
  ] : [];
  const adminSteps: [string, string][] = [
    ["Entrar al panel", "Con “Ver panel del negocio” entrás como el comercio, sin contraseña."],
    ["Ver el pedido", "Pedidos → el pedido que acabás de hacer aparece como nuevo."],
    ["Cambiar el estado", "Confirmado, preparando, enviado o entregado; cada cambio queda en el historial."],
    ["Mostrar el stock", "Stock → la variante que compraste bajó; se puede ajustar con motivo."],
    ["Editar un producto", "Productos → precio, precio anterior (oferta), variantes y fotos."],
    ["Crear una promoción", "Promociones → un cupón nuevo o un banner para el inicio."],
    ["Mostrar las métricas", "Inicio → ventas del día y del mes, últimos 30 días y más vendidos."],
  ];

  return (
    <div style={BRAND} className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/tienda-online" className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-fg text-sm font-bold text-bg">BM</span><span className="font-semibold tracking-tight">BM Dev <span className="text-accent">E-commerce</span></span></Link>
          <Link href="/tienda-online#solicitud" className={buttonClasses("primary", "sm")}>Quiero mi tienda</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Demo en vivo</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-5xl">Probá una tienda real, como cliente y como comercio.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">Son tiendas de ejemplo funcionando con el mismo sistema que va a tener la tuya. Los pagos son simulados y los datos, ficticios.</p>

        {current ? (
          <>
            <nav aria-label="Elegí un rubro" className="mt-8 -mx-4 overflow-x-auto px-4">
              <ul className="flex w-max gap-2">
                {demos.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/demo?rubro=${d.slug}`} aria-current={d.slug === current.slug ? "page" : undefined}
                      className={`flex h-10 items-center rounded-full border px-4 text-sm ${d.slug === current.slug ? "border-fg bg-fg text-bg" : "border-line hover:border-fg/40"}`}>
                      {d.industry} · {d.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <section className="mt-8 grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]" aria-label={`Demo de ${current.name}`}>
              <div className="relative order-last lg:order-none">
                <DesktopPreview demo={current} domain={`www.${current.slug}.com.ar`} />
                <div className="absolute -right-2 -bottom-8 hidden sm:block"><PhonePreview demo={current} compact /></div>
              </div>
              <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-semibold">{current.name}</h2>
                <p className="text-muted">{current.tagline}</p>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <Link href={s()} className={buttonClasses("primary", "lg")}><Store className="size-5" aria-hidden /> Ver tienda</Link>
                  {demoLogin ? (
                    <form action={demoLoginAction}>
                      <input type="hidden" name="slug" value={current.slug} />
                      <button type="submit" className={buttonClasses("secondary", "lg", "w-full")}><LayoutDashboard className="size-5" aria-hidden /> Ver panel del negocio</button>
                    </form>
                  ) : null}
                </div>
                {tour?.coupons.length ? <p className="text-sm text-muted">Cupones para probar: {tour.coupons.map((c) => <code key={c.code} className="mr-1.5 rounded bg-surface px-1.5 py-0.5 font-mono text-fg">{c.code}</code>)}</p> : null}
              </div>
            </section>

            <section className="mt-16" aria-labelledby="recorrido">
              <h2 id="recorrido" className="text-2xl font-bold tracking-tight sm:text-3xl">Recorrido sugerido para una reunión</h2>
              <p className="mt-2 text-muted">Unos 10 minutos. Primero comprás como cliente desde el celular y después mostrás cómo lo administra el comercio.</p>
              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-semibold"><Store className="size-4" aria-hidden /> Como cliente</h3>
                  <ol className="flex flex-col gap-2">
                    {shopSteps.map(([title, href, text], i) => (
                      <li key={title} className="flex gap-3 rounded-xl border border-line p-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">{i + 1}</span>
                        <span className="min-w-0 text-sm">
                          {href ? <Link href={href} className="inline-flex items-center gap-1 font-semibold hover:underline">{title} <ArrowRight className="size-3.5" aria-hidden /></Link> : <span className="font-semibold">{title}</span>}
                          <span className="block text-muted">{text}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-semibold"><LayoutDashboard className="size-4" aria-hidden /> Como comercio</h3>
                  <ol className="flex flex-col gap-2" start={shopSteps.length + 1}>
                    {adminSteps.map(([title, text], i) => (
                      <li key={title} className="flex gap-3 rounded-xl border border-line p-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fg text-sm font-bold text-bg">{shopSteps.length + i + 1}</span>
                        <span className="text-sm"><span className="font-semibold">{title}</span><span className="block text-muted">{text}</span></span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4"><AdminPreview storeName={current.name} /></div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <p className="mt-8 rounded-xl bg-surface p-6 text-muted">Las tiendas de ejemplo no están disponibles en este momento. <Link href="/tienda-online#solicitud" className="underline">Contanos tu idea</Link> y te mostramos una demo personalizada.</p>
        )}

        <section className="mt-16 flex flex-col items-center gap-4 rounded-2xl bg-fg px-6 py-12 text-center text-bg">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">¿Te imaginás tu negocio acá?</h2>
          <p className="max-w-xl text-white/70">Lo adaptamos a tu marca, tus productos y tu forma de vender.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/tienda-online#solicitud" className={buttonClasses("primary", "lg")}>Solicitar presupuesto</Link>
            {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClasses("whatsapp", "lg")}>Hablar por WhatsApp</a> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
