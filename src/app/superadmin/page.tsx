import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getPlatformTotals } from "@/lib/services/superadmin/queries";
import { LEAD_STATUS_LABEL } from "@/lib/services/superadmin/rules";
import { formatPrice } from "@/lib/money";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { formatDateTime } from "@/components/admin/labels";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Inicio" };

export default async function SuperadminHome() {
  await requireSuperadmin();
  const [totals, newLeads, leads] = await Promise.all([
    getPlatformTotals(),
    db.lead.count({ where: { status: "NEW" } }),
    db.lead.findMany({ where: { status: { not: "SPAM" } }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, businessName: true, industry: true, status: true, createdAt: true } }),
  ]);
  const cards = [
    ["Solicitudes nuevas", String(newLeads), "/superadmin/solicitudes?estado=NEW"],
    ["Tiendas activas", String(totals.active), "/superadmin/tiendas?estado=ACTIVE"],
    ["En borrador", String(totals.draft), "/superadmin/tiendas?estado=DRAFT"],
    ["Ventas 30 días", formatPrice(totals.gmv30d), null],
  ] as const;
  return (
    <>
      <PageHeader title="Panel BM Dev" description={`${totals.total} tiendas · ${totals.orders30d} pedidos en los últimos 30 días (incluye demos).`} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value, href]) => {
          const body = (<><p className="text-xs text-muted">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></>);
          return href
            ? <Link key={label} href={href} className="rounded-xl border border-line bg-bg p-4 hover:border-fg/30">{body}</Link>
            : <div key={label} className="rounded-xl border border-line bg-bg p-4">{body}</div>;
        })}
      </div>
      <Panel title="Últimas solicitudes" action={<Link href="/superadmin/solicitudes" className="text-sm text-muted hover:text-fg">Ver todas</Link>}>
        {leads.length ? (
          <ul className="divide-y divide-line">
            {leads.map((l) => (
              <li key={l.id}>
                <Link href={`/superadmin/solicitudes/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface sm:px-5">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{l.businessName}</span><span className="block text-xs text-muted">{l.industry} · {formatDateTime(l.createdAt)}</span></span>
                  <Badge tone={l.status === "NEW" ? "blue" : l.status === "WON" ? "green" : "neutral"}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-muted">Todavía no llegaron solicitudes desde /tienda-online.</p>}
      </Panel>
    </>
  );
}
