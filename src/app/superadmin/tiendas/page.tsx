import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireSuperadmin } from "@/lib/auth/session";
import { listStores } from "@/lib/services/superadmin/queries";
import { PLAN_LABEL, STATUSES, STATUS_LABEL } from "@/lib/services/superadmin/constants";
import { strParam } from "@/lib/services/admin/common";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Tiendas" };
type Search = Promise<Record<string, string | string[] | undefined>>;
type Status = (typeof STATUSES)[number];

export default async function StoresPage({ searchParams }: { searchParams: Search }) {
  await requireSuperadmin();
  const sp = await searchParams;
  const raw = strParam(sp.estado);
  const status = (STATUSES as readonly string[]).includes(raw) ? (raw as Status) : undefined;
  const q = strParam(sp.q);
  const stores = await listStores({ status, q });
  return (
    <>
      <PageHeader title="Tiendas" description="Todas las tiendas de la plataforma, incluidas las demos.">
        <Link href="/superadmin/tiendas/nueva" className={buttonClasses("primary", "sm")}><Plus className="size-4" aria-hidden /> Nueva tienda</Link>
      </PageHeader>
      <form action="/superadmin/tiendas" className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Buscar tiendas</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Nombre, dirección, dominio o email" className="h-10 pl-9" />
        </label>
        <label className="sm:w-44">
          <span className="sr-only">Estado</span>
          <Select name="estado" defaultValue={status ?? ""} className="h-10">
            <option value="">Todos los estados</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
        </label>
        <button type="submit" className={buttonClasses("primary", "sm", "h-10")}>Buscar</button>
      </form>
      <Panel>
        {stores.length ? (
          <ul className="divide-y divide-line">
            {stores.map((s) => (
              <li key={s.id}>
                <Link href={`/superadmin/tiendas/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {s.domains[0]?.hostname ?? `/s/${s.slug}`} · {s.industry} · {s.users[0]?.email ?? "sin dueño"}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span className="tabular-nums">{s._count.products} prod. · {s._count.orders} ped. 30 d</span>
                    {s.isDemo ? <Badge tone="violet">Demo</Badge> : null}
                    <Badge tone="neutral">{PLAN_LABEL[s.plan]}</Badge>
                    <Badge tone={s.status === "ACTIVE" ? "green" : s.status === "SUSPENDED" ? "red" : "amber"}>{STATUS_LABEL[s.status]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-10 text-center text-sm text-muted">No hay tiendas con esos filtros.</p>}
      </Panel>
    </>
  );
}
