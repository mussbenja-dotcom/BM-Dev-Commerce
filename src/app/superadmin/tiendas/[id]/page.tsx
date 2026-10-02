import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, LifeBuoy } from "lucide-react";
import { requireSuperadmin } from "@/lib/auth/session";
import { getStoreDetail } from "@/lib/services/superadmin/queries";
import { PLAN_LABEL, STATUS_LABEL } from "@/lib/services/superadmin/constants";
import { formatPrice } from "@/lib/money";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { formatDateTime } from "@/components/admin/labels";
import { AddDomainForm, AddUserForm, DomainActions, StoreSettingsForm, UserActions } from "@/components/superadmin/forms";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { enterSupportAction } from "../../actions";

export const metadata: Metadata = { title: "Tienda" };
const ROLE_LABEL = { STORE_OWNER: "Dueño/a", STORE_ADMIN: "Administrador/a", SUPERADMIN_BMDEV: "BM Dev" } as const;

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperadmin();
  const { id } = await params;
  const detail = await getStoreDetail(id.slice(0, 40));
  if (!detail) notFound();
  const { store, orders30d, gmv30d, lastOrder, activity } = detail;
  const stats: [string, string][] = [
    ["Pedidos 30 días", String(orders30d)],
    ["Ventas 30 días", formatPrice(gmv30d)],
    ["Productos", String(store._count.products)],
    ["Clientes", String(store._count.customers)],
  ];
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/superadmin/tiendas" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" aria-hidden /> Tiendas</Link>
      <PageHeader title={store.name} description={`/s/${store.slug} · ${store.industry} · plantilla ${store.template} · creada ${formatDateTime(store.createdAt)}`}>
        <div className="flex flex-wrap items-center gap-2">
          {store.isDemo ? <Badge tone="violet">Demo</Badge> : null}
          <Badge tone={store.status === "ACTIVE" ? "green" : store.status === "SUSPENDED" ? "red" : "amber"}>{STATUS_LABEL[store.status]}</Badge>
          <Badge tone="neutral">{PLAN_LABEL[store.plan]}</Badge>
          <Link href={`/s/${store.slug}`} target="_blank" className={buttonClasses("secondary", "sm")}>Ver tienda <ExternalLink className="size-3.5" aria-hidden /></Link>
          <form action={enterSupportAction}>
            <input type="hidden" name="storeId" value={store.id} />
            <button type="submit" className={buttonClasses("primary", "sm")}><LifeBuoy className="size-4" aria-hidden /> Entrar en modo soporte</button>
          </form>
        </div>
      </PageHeader>

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([k, v]) => <div key={k} className="rounded-xl border border-line bg-bg p-3 sm:p-4"><dt className="text-xs text-muted">{k}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd></div>)}
      </dl>
      {store.status !== "ACTIVE" ? (
        <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {store.status === "DRAFT" ? "En borrador: la tienda pública no se muestra hasta pasarla a Activa." : "Suspendida: la tienda no se muestra y su equipo no puede ingresar."}
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        <Panel title="Estado, plan y notas">
          <div className="p-4 sm:p-5"><StoreSettingsForm store={{ id: store.id, name: store.name, status: store.status, plan: store.plan, notes: store.notes ?? "" }} /></div>
        </Panel>

        <Panel title="Dominios">
          <ul className="divide-y divide-line">
            {store.domains.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                <span className="text-sm">
                  <span className="font-medium">{d.hostname}</span>
                  <span className="ml-2 inline-flex gap-1.5 align-middle">
                    {d.isPrimary ? <Badge tone="blue">Principal</Badge> : null}
                    <Badge tone={d.verified ? "green" : "amber"}>{d.verified ? "Verificado" : "Sin verificar"}</Badge>
                  </span>
                </span>
                <DomainActions storeId={store.id} domain={{ id: d.id, hostname: d.hostname, isPrimary: d.isPrimary, verified: d.verified }} />
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-4 sm:p-5"><AddDomainForm storeId={store.id} /></div>
        </Panel>

        <Panel title="Usuarios">
          <ul className="divide-y divide-line">
            {store.users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
                <span className="text-sm">
                  <span className="font-medium">{u.name}</span> <span className="text-muted">· {u.email}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{ROLE_LABEL[u.role]}</Badge>
                    {!u.active ? <Badge tone="red">Desactivado</Badge> : null}
                    {u.isDemo ? <Badge tone="violet">Demo</Badge> : null}
                  </span>
                  <span className="mt-1 block text-xs text-muted">{u.lastLoginAt ? `Último ingreso ${formatDateTime(u.lastLoginAt)}` : "Nunca ingresó"}</span>
                </span>
                <UserActions storeId={store.id} user={{ id: u.id, email: u.email, active: u.active }} />
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-4 sm:p-5"><AddUserForm storeId={store.id} /></div>
        </Panel>

        <Panel title="Actividad reciente">
          {activity.length ? (
            <ul className="divide-y divide-line text-sm">
              {activity.map((a) => <li key={a.id} className="flex justify-between gap-3 px-4 py-2.5 sm:px-5"><span className="font-mono text-xs">{a.action}</span><span className="text-xs text-muted">{a.user?.email ?? "sistema"} · {formatDateTime(a.createdAt)}</span></li>)}
            </ul>
          ) : <p className="px-5 py-6 text-sm text-muted">Sin actividad registrada.</p>}
          {lastOrder ? <p className="border-t border-line px-5 py-3 text-xs text-muted">Último pedido #{lastOrder.number} · {formatDateTime(lastOrder.createdAt)}</p> : null}
        </Panel>
      </div>
    </div>
  );
}
