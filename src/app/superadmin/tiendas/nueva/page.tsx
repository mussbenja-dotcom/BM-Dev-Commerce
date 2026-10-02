import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSuperadmin } from "@/lib/auth/session";
import { getLead } from "@/lib/services/superadmin/leads";
import { INDUSTRIES } from "@/lib/services/superadmin/constants";
import { TEMPLATES } from "@/lib/templates";
import { PageHeader } from "@/components/admin/order-badges";
import { NewStoreForm } from "@/components/superadmin/forms";

export const metadata: Metadata = { title: "Nueva tienda" };

// Landing industries that are not in the store list map to the closest option.
const INDUSTRY_ALIAS: Record<string, string> = { "Comercio general": "Otro" };

export default async function NewStorePage({ searchParams }: { searchParams: Promise<{ solicitud?: string }> }) {
  await requireSuperadmin();
  const { solicitud } = await searchParams;
  const lead = solicitud ? await getLead(solicitud.slice(0, 40)) : null;
  const usableLead = lead && !lead.storeId ? lead : null;
  const templates = Object.values(TEMPLATES).map((t) => ({ key: t.key, label: t.label }));
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/superadmin/tiendas" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" aria-hidden /> Tiendas</Link>
      <PageHeader title="Nueva tienda" description={usableLead ? `Con los datos de la solicitud de ${usableLead.businessName}. Al crearla, la solicitud queda como ganada.` : "Crea la tienda en borrador, su dueño y una contraseña temporal."} />
      <NewStoreForm
        templates={templates}
        industries={INDUSTRIES}
        values={{
          leadId: usableLead?.id,
          name: usableLead?.businessName ?? "",
          ownerName: usableLead?.name ?? "",
          ownerEmail: usableLead?.email ?? "",
          whatsapp: usableLead?.whatsapp ?? "",
          industry: usableLead ? (INDUSTRY_ALIAS[usableLead.industry] ?? usableLead.industry) : "Moda",
        }}
      />
    </div>
  );
}
