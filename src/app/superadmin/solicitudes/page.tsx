import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { requireSuperadmin } from "@/lib/auth/session";
import { listLeads } from "@/lib/services/superadmin/leads";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/services/superadmin/rules";
import { pageParam, strParam } from "@/lib/services/admin/common";
import { NEEDS } from "@/lib/services/leads/form";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { formatDateTime } from "@/components/admin/labels";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Solicitudes" };
type Search = Promise<Record<string, string | string[] | undefined>>;
type Status = (typeof LEAD_STATUSES)[number];

export default async function LeadsPage({ searchParams }: { searchParams: Search }) {
  await requireSuperadmin();
  const sp = await searchParams;
  const raw = strParam(sp.estado);
  const status = (LEAD_STATUSES as readonly string[]).includes(raw) ? (raw as Status) : undefined;
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const { rows, total, pages, byStatus } = await listLeads({ status, q, page });
  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ estado: status, q: q || undefined, page: undefined as number | undefined, ...patch })) if (v !== undefined && v !== "") params.set(k, String(v));
    const s = params.toString();
    return `/superadmin/solicitudes${s ? `?${s}` : ""}`;
  };
  const tabs: { key?: Status; label: string; count?: number }[] = [{ label: "Todas" }, ...LEAD_STATUSES.map((k) => ({ key: k, label: LEAD_STATUS_LABEL[k], count: byStatus[k] ?? 0 }))];

  return (
    <>
      <PageHeader title="Solicitudes" description="Pedidos de tienda que llegan desde la página comercial (/tienda-online)." />
      <div className="-mx-4 mb-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <nav aria-label="Filtrar por estado" className="flex w-max gap-1 rounded-xl border border-line bg-bg p-1">
          {tabs.map((t) => (
            <Link key={t.label} href={href({ estado: t.key })} aria-current={t.key === status ? "page" : undefined}
              className={cn("flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm whitespace-nowrap", t.key === status ? "bg-fg text-bg" : "text-muted hover:text-fg")}>
              {t.label}{t.count !== undefined ? <span className="text-xs tabular-nums opacity-70">{t.count}</span> : null}
            </Link>
          ))}
        </nav>
      </div>
      <form action="/superadmin/solicitudes" className="mb-4 flex gap-2" role="search">
        {status ? <input type="hidden" name="estado" value={status} /> : null}
        <label className="relative flex-1">
          <span className="sr-only">Buscar solicitudes</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Negocio, nombre, email, WhatsApp o Instagram" className="h-10 pl-9" />
        </label>
        <button type="submit" className={buttonClasses("primary", "sm", "h-10")}>Buscar</button>
      </form>
      <Panel>
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((l) => (
              <li key={l.id}>
                <Link href={`/superadmin/solicitudes/${l.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{l.businessName} <span className="font-normal text-muted">· {l.name}</span></span>
                    <span className="block truncate text-xs text-muted">{l.industry} · {NEEDS[l.needs as keyof typeof NEEDS] ?? l.needs} · {formatDateTime(l.createdAt)}</span>
                  </span>
                  <Badge tone={l.status === "NEW" ? "blue" : l.status === "WON" ? "green" : l.status === "LOST" || l.status === "SPAM" ? "neutral" : "amber"}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-10 text-center text-sm text-muted">{q || status ? "No hay solicitudes con esos filtros." : "Todavía no llegaron solicitudes."}</p>}
      </Panel>
      {pages > 1 ? (
        <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{total} solicitudes · página {Math.min(page, pages)} de {pages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={href({ page: page - 1 })} className={buttonClasses("secondary", "sm")} aria-label="Página anterior"><ChevronLeft className="size-4" aria-hidden /></Link> : null}
            {page < pages ? <Link href={href({ page: page + 1 })} className={buttonClasses("secondary", "sm")} aria-label="Página siguiente"><ChevronRight className="size-4" aria-hidden /></Link> : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
