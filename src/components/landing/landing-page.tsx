import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight, Boxes, Check, ClipboardList, CreditCard, FolderTree, Globe, HeartHandshake, Landmark, LayoutDashboard,
  LayoutGrid, LifeBuoy, MessageCircle, Palette, Percent, ShoppingCart, Smartphone, Sparkles, TicketPercent, Wand2,
} from "lucide-react";
import { demoLoginAction } from "@/lib/auth/actions";
import type { LandingDemo } from "@/lib/services/landing";
import { buttonClasses } from "@/components/ui/button";
import { AdminPreview, DesktopPreview, PhonePreview } from "./previews";
import { LeadForm } from "./lead-form";

// BM Dev brand tokens for this page. Primary is the CTA color (AA contrast with white text).
const BRAND: CSSProperties = {
  "--c-bg": "#ffffff",
  "--c-surface": "#f5f4f1",
  "--c-fg": "#111318",
  "--c-muted": "#5b6068",
  "--c-line": "#e5e3de",
  "--c-primary": "#c43e0c",
  "--c-on-primary": "#ffffff",
  "--c-accent": "#e8551f",
  "--r": "10px",
} as CSSProperties;

const INCLUDES = [
  [Palette, "Diseño personalizado", "Una tienda pensada para tu marca, no una plantilla igual a la de todos."],
  [Globe, "Dominio propio", "Tu tienda en tunegocio.com.ar, con tu nombre."],
  [Wand2, "Tu logo y tus colores", "Tu identidad en cada pantalla, del inicio al checkout."],
  [LayoutGrid, "Catálogo", "Fotos, variantes de talle o color, ofertas y destacados."],
  [FolderTree, "Categorías", "Tus clientes encuentran rápido lo que buscan."],
  [ShoppingCart, "Carrito y checkout", "Una compra simple y clara, pensada para no perder ventas."],
  [CreditCard, "Mercado Pago", "Cobrá con tarjeta, débito o dinero en cuenta."],
  [Landmark, "Transferencia", "Con descuento por transferencia si querés incentivarla."],
  [MessageCircle, "WhatsApp", "Consultas y pedidos directo a tu WhatsApp."],
  [ClipboardList, "Gestión de pedidos", "Cada venta ordenada, con su estado y su historial."],
  [Boxes, "Control de stock", "El stock se descuenta solo y te avisa cuando queda poco."],
  [TicketPercent, "Cupones y promociones", "Descuentos, envío gratis y campañas cuando lo necesites."],
  [LayoutDashboard, "Panel administrativo", "Manejás tu tienda vos, sin depender de nadie."],
  [Smartphone, "Optimizada para celular", "La mayoría compra desde el teléfono: tu tienda está lista."],
  [LifeBuoy, "Soporte de BM Dev", "Te acompañamos antes, durante y después de publicarla."],
] as const;

const STEPS = [
  ["Nos contás sobre tu negocio", "Qué vendés, a quién y cómo trabajás hoy."],
  ["Personalizamos tu tienda", "Diseño, colores, logo y secciones a tu medida."],
  ["Configuramos productos, pagos y dominio", "Cargamos tu catálogo y dejamos listos los cobros y tu dirección web."],
  ["La publicamos", "Tu tienda online sale al aire y empezás a vender."],
] as const;

const DIFFERENTIATORS = [
  [Sparkles, "Desarrollo personalizado", "Tu tienda se construye para tu negocio, con lo que realmente necesitás."],
  [Percent, "Sin comisión de BM Dev por venta", "No nos quedamos con un porcentaje de lo que vendés. Los costos de procesamiento son los del medio de pago que elijas (por ejemplo, Mercado Pago)."],
  [HeartHandshake, "Soporte cercano", "Hablás con personas que conocen tu tienda."],
  [Wand2, "Adaptada a tu rubro", "Moda, pastelería, cosmética o regalería: cada tienda se arma distinto."],
  [Smartphone, "Pensada para el celular", "Rápida y cómoda en el teléfono, donde compran tus clientes."],
  [LayoutDashboard, "Administración sencilla", "Pedidos, stock y promociones desde un panel claro."],
] as const;

const INDUSTRIES = ["Moda", "Calzado", "Cosmética", "Pastelería", "Regalería", "Decoración", "Alimentos", "Comercio general"];

function Section({ id, eyebrow, title, intro, children, className = "" }: { id?: string; eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24 ${className}`}>
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p> : null}
          <h2 id={id ? `${id}-title` : undefined} className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
          {intro ? <p className="mt-4 text-lg text-muted text-pretty">{intro}</p> : null}
        </div>
        <div className="mt-10 sm:mt-12">{children}</div>
      </div>
    </section>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-lg bg-fg text-sm font-bold text-bg">BM</span>
      <span className="font-semibold tracking-tight">BM Dev <span className="text-accent">E-commerce</span></span>
    </span>
  );
}

function WhatsappLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClasses("whatsapp", "lg", className)}>
      <MessageCircle size={18} aria-hidden /> {children}
    </a>
  );
}

export function LandingPage({ demos, whatsappUrl, demoLoginEnabled }: { demos: LandingDemo[]; whatsappUrl: string | null; demoLoginEnabled: boolean }) {
  const hero = demos[0];
  const phone = demos[1] ?? demos[0];
  const canDemoLogin = demoLoginEnabled && demos.some((d) => d.slug === "alma");

  return (
    <div style={BRAND} className="flex min-h-dvh flex-col bg-bg pb-20 text-fg md:pb-0">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-bg focus:px-3 focus:py-2">Saltar al contenido</a>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/tienda-online" aria-label="BM Dev E-commerce, inicio"><Logo /></Link>
          <nav aria-label="Secciones" className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#incluye" className="hover:text-fg">Qué incluye</a>
            <a href="#como-funciona" className="hover:text-fg">Cómo funciona</a>
            <Link href="/demo" className="hover:text-fg">Demo</Link>
            <Link href="/login" className="hover:text-fg">Ingresar</Link>
          </nav>
          <a href="#solicitud" className={buttonClasses("primary", "sm", "px-4")}>Quiero mi tienda</a>
        </div>
      </header>

      <main id="contenido" className="flex-1">
        {/* 1. Hero */}
        <section className="overflow-hidden bg-surface px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1 text-sm text-muted">
                <span className="size-2 rounded-full bg-accent" aria-hidden /> Tiendas online personalizadas
              </p>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">Tu tienda online, hecha para tu negocio.</h1>
              <p className="mt-5 max-w-xl text-lg text-muted text-pretty sm:text-xl">
                Creamos tiendas online personalizadas para emprendimientos y comercios. Tu marca, tu dominio, tus productos y tu propia administración.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#solicitud" className={buttonClasses("primary", "lg")}>Quiero mi tienda online <ArrowRight size={18} aria-hidden /></a>
                <Link href="/demo" className={buttonClasses("secondary", "lg")}>Ver demo</Link>
              </div>
              <ul className="mt-8 grid gap-2 text-sm text-fg sm:grid-cols-2">
                {["Sin comisión de BM Dev por venta", "Tu dominio y tu marca", "Mercado Pago, transferencia y WhatsApp", "Panel para manejar tus pedidos"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check size={16} className="shrink-0 text-accent" aria-hidden />{t}</li>
                ))}
              </ul>
            </div>
            {hero ? (
              <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
                <DesktopPreview demo={hero} />
                {phone ? <div className="absolute -right-2 -bottom-10 hidden sm:block lg:-right-6"><PhonePreview demo={phone} /></div> : null}
              </div>
            ) : null}
          </div>
        </section>

        {/* 2. Ejemplos por rubro */}
        <Section id="ejemplos" eyebrow="Para cada rubro" title="Una tienda distinta para cada negocio" intro="La misma base, adaptada a lo que vendés. Mirá cómo cambia según el rubro.">
          {demos.length ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {demos.map((d) => (
                <li key={d.slug} className="flex flex-col overflow-hidden rounded-2xl border border-line">
                  <div className="p-4" style={{ background: d.colors.surface }}><DesktopPreview demo={d} domain={`www.${d.slug}.com.ar`} /></div>
                  <div className="flex flex-1 flex-col gap-1 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{d.industry}</p>
                    <h3 className="text-lg font-semibold">{d.name}</h3>
                    {d.tagline ? <p className="text-sm text-muted">{d.tagline}</p> : null}
                    <Link href={`/s/${d.slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
                      Ver tienda de ejemplo <ArrowRight size={14} aria-hidden />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <ul aria-label="Rubros" className="mt-8 flex flex-wrap gap-2">
            {INDUSTRIES.map((i) => <li key={i} className="rounded-full border border-line bg-bg px-3.5 py-1.5 text-sm">{i}</li>)}
          </ul>
        </Section>

        {/* 3. Qué incluye */}
        <Section id="incluye" eyebrow="Qué incluye" title="Todo lo que tu negocio necesita para vender online" intro="Tus clientes compran fácil y vos administrás todo desde un solo lugar." className="bg-surface">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDES.map(([Icon, title, text]) => (
              <li key={title} className="flex gap-4 rounded-2xl border border-line bg-bg p-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-primary"><Icon size={20} aria-hidden /></span>
                <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted">{text}</p></div>
              </li>
            ))}
          </ul>
        </Section>

        {/* 4. Personalización */}
        <Section id="personalizacion" eyebrow="Personalización" title="No te damos una tienda genérica. La adaptamos a tu negocio." intro="Tu logo, tus colores, tu dominio, tus productos y un diseño que se siente tuyo.">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <ul className="grid gap-3">
              {[
                ["Logo y colores", "Tu identidad aplicada en toda la tienda."],
                ["Dominio propio", "Tus clientes te encuentran en tu dirección web."],
                ["Tus productos", "Fotos, variantes, precios y categorías como los manejás vos."],
                ["Diseño y secciones", "Elegimos juntos qué mostrar primero: novedades, ofertas, más vendidos."],
                ["Formas de pago y envío", "Mercado Pago, transferencia, efectivo, envíos por zona o retiro."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3 rounded-xl border border-line p-4">
                  <Check size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  <div><p className="font-semibold">{t}</p><p className="text-sm text-muted">{d}</p></div>
                </li>
              ))}
            </ul>
            {demos.length >= 3 ? (
              <div className="flex justify-center gap-3 pb-8 sm:gap-4" aria-label="La misma base con tres estilos distintos">
                {demos.slice(2, 5).map((d, i) => <div key={d.slug} className={i === 1 ? "" : "hidden sm:block sm:translate-y-8"}><PhonePreview demo={d} compact /></div>)}
              </div>
            ) : null}
          </div>
        </Section>

        {/* 5. Cómo funciona */}
        <Section id="como-funciona" eyebrow="Cómo funciona" title="De la idea a tu tienda publicada, en 4 pasos" className="bg-fg text-bg [&_p.text-muted]:text-white/70">
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="rounded-2xl border border-white/15 p-6">
                <span className="grid size-10 place-items-center rounded-full bg-accent text-lg font-bold text-white" aria-hidden>{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
          <a href="#solicitud" className={buttonClasses("primary", "lg", "mt-10")}>Contanos tu idea <ArrowRight size={18} aria-hidden /></a>
        </Section>

        {/* 6. Demo */}
        <Section id="demo" eyebrow="Demo" title="Conocé cómo podría verse tu tienda" intro="Mirá cómo compra tu cliente y cómo administrás tu negocio. Son tiendas de ejemplo, funcionando de verdad.">
          {hero ? (
            <div className="grid items-start gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted">En la computadora</h3>
                <DesktopPreview demo={hero} />
              </div>
              <div className="flex flex-col items-center lg:items-start">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted">En el celular</h3>
                <PhonePreview demo={hero} />
              </div>
              <div className="lg:col-span-2">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted">Tu panel de administración</h3>
                <AdminPreview storeName={hero.name} />
              </div>
              <div className="flex flex-col gap-3 rounded-2xl bg-surface p-6">
                <p className="font-semibold">Probá las tiendas de ejemplo</p>
                <ul className="flex flex-col gap-2">
                  {demos.map((d) => (
                    <li key={d.slug}><Link href={`/s/${d.slug}`} className="flex items-center justify-between rounded-lg border border-line bg-bg px-3 py-2.5 text-sm hover:border-fg/40">{d.name} <span className="text-muted">{d.industry}</span></Link></li>
                  ))}
                </ul>
                <Link href="/demo" className={buttonClasses("primary", "md", "mt-2")}>Ver demo con recorrido</Link>
                {canDemoLogin ? (
                  <form action={demoLoginAction}>
                    <input type="hidden" name="slug" value="alma" />
                    <button type="submit" className={buttonClasses("secondary", "md", "w-full")}>Ver el panel del comercio</button>
                  </form>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-muted">Pronto vas a poder ver tiendas de ejemplo acá. Mientras tanto, <a href="#solicitud" className="underline">contanos tu idea</a>.</p>
          )}
        </Section>

        {/* 7. Diferenciales */}
        <Section id="diferenciales" eyebrow="Por qué BM Dev" title="Una tienda propia, con alguien que te acompaña" className="bg-surface">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DIFFERENTIATORS.map(([Icon, title, text]) => (
              <li key={title} className="rounded-2xl border border-line bg-bg p-6">
                <Icon size={22} className="text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* 8. Solicitud */}
        <Section id="solicitud" eyebrow="Solicitar presupuesto" title="Contanos qué necesitás" intro="Cada negocio es distinto: el presupuesto depende de la cantidad de productos, el diseño, el dominio y las funciones que quieras. Completá el formulario y te respondemos con una propuesta.">
          <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
            <LeadForm fallbackWhatsappUrl={whatsappUrl} />
            <aside className="flex flex-col gap-4 rounded-2xl bg-surface p-6 text-sm">
              <p className="font-semibold">¿Preferís hablar directo?</p>
              <p className="text-muted">Escribinos y contanos sobre tu negocio. Te respondemos personalmente.</p>
              {whatsappUrl ? <WhatsappLink href={whatsappUrl} className="w-full">Quiero mi tienda</WhatsappLink> : null}
              <ul className="mt-2 flex flex-col gap-2">
                {["Presupuesto sin compromiso", "Sin comisión de BM Dev por venta", "Te acompañamos en todo el proceso"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check size={16} className="text-accent" aria-hidden />{t}</li>
                ))}
              </ul>
            </aside>
          </div>
        </Section>

        {/* 9. CTA final */}
        <section className="bg-fg px-4 py-16 text-bg sm:px-6 sm:py-20">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Empezá a vender con tu propia tienda online.</h2>
            <p className="max-w-2xl text-lg text-white/70">Tu marca, tus productos y tus clientes, en una tienda hecha para tu negocio.</p>
            <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <a href="#solicitud" className={buttonClasses("primary", "lg")}>Solicitar mi tienda</a>
              {whatsappUrl ? <WhatsappLink href={whatsappUrl}>Quiero mi tienda</WhatsappLink> : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-8 text-sm text-muted sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <Logo />
          <p>Tiendas online personalizadas, por <a href="https://bmdev.solutions" className="underline-offset-4 hover:underline" rel="noopener">BM Dev</a>.</p>
          <Link href="/login" className="underline-offset-4 hover:text-fg hover:underline">Ingresar a mi panel</Link>
        </div>
      </footer>

      {/* Mobile: the main action is always one tap away. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-bg/95 p-3 backdrop-blur md:hidden">
        <a href="#solicitud" className={buttonClasses("primary", "md", "flex-1")}>Solicitar presupuesto</a>
        {whatsappUrl ? (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label="Escribir a BM Dev por WhatsApp" className={buttonClasses("whatsapp", "md", "w-12 px-0")}>
            <MessageCircle size={20} aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}
