"use server";

import { audit } from "@/lib/audit";
import { bmdevWhatsappUrl } from "@/lib/bmdev";
import { clientIp } from "@/lib/request";
import { submitLead } from "@/lib/services/leads/submit";
import type { LeadFormState } from "@/lib/services/leads/form";

export async function submitLeadAction(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  try {
    const result = await submitLead(formData, { ip: await clientIp() });
    if (!result.ok && result.reason === "invalid") {
      return { status: "error", message: "Revisá los datos marcados.", fieldErrors: result.fieldErrors, values: result.values };
    }
    if (!result.ok) {
      const minutes = Math.max(1, Math.ceil(result.retryAfter / 60));
      return { status: "error", message: `Recibimos varias solicitudes desde tu conexión. Probá de nuevo en ${minutes} minutos o escribinos por WhatsApp.`, values: result.values };
    }
    if (result.spam) return { status: "success", whatsappUrl: bmdevWhatsappUrl() };
    await audit({ action: "lead.created", entity: "Lead", entityId: result.lead.id, meta: { industry: result.lead.industry } });
    return { status: "success", whatsappUrl: bmdevWhatsappUrl(result.lead) };
  } catch (error) {
    console.error("[lead] could not save", error);
    return { status: "error", message: "No pudimos enviar tu solicitud. Probá de nuevo o escribinos por WhatsApp." };
  }
}
