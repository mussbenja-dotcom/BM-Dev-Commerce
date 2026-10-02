import type { Metadata } from "next";
import { requireStoreSession } from "@/lib/auth/session";
import { listCoupons } from "@/lib/services/admin/coupons";
import { COUPON_STATE_LABEL, couponState, describeCoupon, type CouponState } from "@/lib/services/admin/coupon-rules";
import { formatPrice } from "@/lib/money";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { BannerForm, CouponActiveForm, CouponForm } from "@/components/admin/coupon-forms";
import { listBanners } from "@/lib/services/admin/banners";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Promociones" };

const TONE: Record<CouponState, BadgeTone> = { active: "green", scheduled: "blue", expired: "neutral", exhausted: "amber", paused: "neutral" };
// <input type="date"> value in Argentina time (UTC-3, no DST).
const dateInput = (d: Date | null) => (d ? new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10) : "");
const shortDate = (d: Date) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(d);

export default async function PromotionsPage() {
  const session = await requireStoreSession();
  const [coupons, banners] = await Promise.all([listCoupons(session.storeId), listBanners(session.storeId)]);
  const now = new Date();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Promociones" description="Cupones para el carrito y banners para el inicio de tu tienda. Las ofertas y destacados se marcan en cada producto." />
      <p className="mb-6 text-sm text-muted">
        ¿Querés poner un producto en oferta? Cargale un <strong>precio anterior</strong> desde <Link href="/admin/productos" className="underline">Productos</Link>; para destacarlo, tildá <strong>Destacado</strong>.
      </p>
      <Panel title="Nuevo cupón" className="mb-6">
        <div className="p-4 sm:p-5">
          <CouponForm coupon={{ code: "", description: "", type: "PERCENT", value: "", minSubtotal: "", maxUses: "", startsAt: "", endsAt: "", active: true, usedCount: 0 }} />
        </div>
      </Panel>
      <Panel title={`Tus cupones (${coupons.length})`}>
        {coupons.length ? (
          <ul className="divide-y divide-line">
            {coupons.map((c) => {
              const state = couponState(c, now);
              return (
                <li key={c.id}>
                  <details className="px-4 py-3 sm:px-5">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="min-w-0">
                        <span className="font-mono text-sm font-semibold">{c.code}</span>
                        <span className="block text-xs text-muted">
                          {describeCoupon(c, formatPrice)}
                          {c.minSubtotal ? ` · desde ${formatPrice(c.minSubtotal)}` : ""}
                          {c.endsAt ? ` · hasta ${shortDate(c.endsAt)}` : ""}
                          {c.description ? ` · ${c.description}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <span className="tabular-nums">{c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ""} usos</span>
                        <Badge tone={TONE[state]}>{COUPON_STATE_LABEL[state]}</Badge>
                      </span>
                    </summary>
                    <div className="mt-4 flex flex-col gap-4">
                      <CouponActiveForm couponId={c.id} active={c.active} />
                      <CouponForm
                        coupon={{
                          id: c.id, code: c.code, description: c.description ?? "", type: c.type, value: String(c.value), minSubtotal: c.minSubtotal?.toString() ?? "",
                          maxUses: c.maxUses?.toString() ?? "", startsAt: dateInput(c.startsAt), endsAt: dateInput(c.endsAt), active: c.active, usedCount: c.usedCount,
                        }}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-muted">Todavía no creaste cupones.</p>}
      </Panel>

      <h2 id="banners" className="mt-10 mb-3 text-lg font-semibold">Banners del inicio</h2>
      <Panel title="Nuevo banner" className="mb-6">
        <div className="p-4 sm:p-5"><BannerForm banner={{ placement: "promo", eyebrow: "", title: "", subtitle: "", ctaLabel: "", ctaHref: "/productos", imageUrl: "", mobileImageUrl: "", position: String(banners.length), active: true }} /></div>
      </Panel>
      <Panel title={`Tus banners (${banners.length})`}>
        {banners.length ? (
          <ul className="divide-y divide-line">
            {banners.map((b) => (
              <li key={b.id}>
                <details className="px-4 py-3 sm:px-5">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                    <span><span className="font-medium">{b.title}</span><span className="block text-xs text-muted">{b.placement === "hero" ? "Portada" : "Promoción"} · orden {b.position}{b.ctaHref ? ` · ${b.ctaHref}` : ""}</span></span>
                    <Badge tone={b.active ? "green" : "neutral"}>{b.active ? "Visible" : "Oculto"}</Badge>
                  </summary>
                  <div className="mt-4">
                    <BannerForm banner={{ id: b.id, placement: b.placement === "hero" ? "hero" : "promo", eyebrow: b.eyebrow ?? "", title: b.title, subtitle: b.subtitle ?? "", ctaLabel: b.ctaLabel ?? "", ctaHref: b.ctaHref ?? "", imageUrl: b.imageUrl, mobileImageUrl: b.mobileImageUrl ?? "", position: String(b.position), active: b.active }} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-muted">Todavía no tenés banners. La portada usa el nombre y la frase de tu tienda.</p>}
      </Panel>
    </div>
  );
}
