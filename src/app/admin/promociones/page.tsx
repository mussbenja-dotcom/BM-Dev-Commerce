import type { Metadata } from "next";
import { requireStoreSession } from "@/lib/auth/session";
import { listCoupons } from "@/lib/services/admin/coupons";
import { COUPON_STATE_LABEL, couponState, describeCoupon, type CouponState } from "@/lib/services/admin/coupon-rules";
import { formatPrice } from "@/lib/money";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { CouponActiveForm, CouponForm } from "@/components/admin/coupon-forms";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Promociones" };

const TONE: Record<CouponState, BadgeTone> = { active: "green", scheduled: "blue", expired: "neutral", exhausted: "amber", paused: "neutral" };
// <input type="date"> value in Argentina time (UTC-3, no DST).
const dateInput = (d: Date | null) => (d ? new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10) : "");
const shortDate = (d: Date) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(d);

export default async function PromotionsPage() {
  const session = await requireStoreSession();
  const coupons = await listCoupons(session.storeId);
  const now = new Date();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Promociones" description="Cupones de descuento o envío gratis que tus clientes aplican en el carrito." />
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
    </div>
  );
}
