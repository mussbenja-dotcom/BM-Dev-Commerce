import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, Store } from "lucide-react";
import { requireSuperadmin } from "@/lib/auth/session";
import { getLead } from "@/lib/services/superadmin/leads";
import { NEEDS, PRODUCT_COUNTS, SELLS_ONLINE } from "@/lib/services/leads/form";
import { PageHeader, Panel } from "@/components/admin/order-badges";
import { formatDateTime, whatsappLink } from "@/components/admin/labels";
import { LeadStatusForm } from "@/components/superadmin/forms";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Solicitud" };
const yesNo = (v: boolean | null) => (v === null ? "Sin respuesta" : v ? "Sí" : "No");

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperadmin();
  const { id } = await params;
  const lead = await getLead(id.slice(0, 40));
  if (!lead) notFound();
  const rows: [string, string][] = [
    ["Rubro", lead.industry],
    ["¿Vende online?", SELLS_ONLINE[lead.sellsOnline as keyof typeof SELLS_ONLINE] ?? lead.sellsOnline],
    ["Productos", PRODUCT_COUNTS[lead.productCount as keyof typeof PRODUCT_COUNTS] ?? lead.productCount],
    ["Necesita", NEEDS[lead.needs as keyof typeof NEEDS] ?? lead.needs],
    ["¿Tiene dominio?", yesNo(lead.hasDomain)],
    ["¿Usa Mercado Pago?", yesNo(lead.usesMercadoPago)],
    ["Instagram", lead.instagram ? `@${lead.instagram}` : "—"],
    ["Recibida", formatDateTime(lead.createdAt)],
  ];
  const message = `Hola ${lead.name}! Te escribimos de BM Dev por la tienda online para ${lead.businessName}.`;
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/superadmin/solicitudes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" aria-hidden /> Solicitudes</Link>
      <PageHeader title={lead.businessName} description={`${lead.name} · ${lead.email} · ${lead.whatsapp}`}>
        <div className="flex flex-wrap gap-2">
          <a href={whatsappLink(lead.whatsapp, message)} target="_blank" rel="noopener noreferrer" className={buttonClasses("whatsapp", "sm")}><MessageCircle className="size-4" aria-hidden /> WhatsApp</a>
          <a href={`mailto:${lead.email}`} className={buttonClasses("secondary", "sm")}><Mail className="size-4" aria-hidden /> Email</a>
        </div>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Panel title="Lo que nos contó">
            <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2 sm:p-5">
              {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5">{v}</dd></div>)}
              {lead.comment ? <div className="sm:col-span-2"><dt className="text-xs text-muted">Comentario</dt><dd className="mt-0.5 whitespace-pre-line">{lead.comment}</dd></div> : null}
            </dl>
          </Panel>
          <Panel title="Tienda">
            <div className="p-4 text-sm sm:p-5">
              {lead.store ? (
                <Link href={`/superadmin/tiendas/${lead.store.id}`} className="inline-flex items-center gap-1.5 font-medium underline"><Store className="size-4" aria-hidden /> {lead.store.name} (/s/{lead.store.slug})</Link>
              ) : (
                <>
                  <p className="mb-3 text-muted">Cuando acepte el presupuesto, creá su tienda con estos datos.</p>
                  <Link href={`/superadmin/tiendas/nueva?solicitud=${lead.id}`} className={buttonClasses("primary", "sm")}>Crear tienda desde esta solicitud</Link>
                </>
              )}
            </div>
          </Panel>
        </div>
        <Panel title="Seguimiento"><div className="p-4 sm:p-5"><LeadStatusForm leadId={lead.id} status={lead.status} notes={lead.notes ?? ""} /></div></Panel>
      </div>
    </div>
  );
}
