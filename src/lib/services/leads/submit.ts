import "server-only";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { HONEYPOT_FIELD, parseLeadForm, readLeadValues, type LeadInput, type LeadField, type LeadValues } from "./form";

export type SubmitLeadResult =
  | { ok: true; spam: false; lead: { id: string } & Pick<LeadInput, "businessName" | "industry" | "instagram"> }
  | { ok: true; spam: true }
  | { ok: false; reason: "invalid"; fieldErrors: Partial<Record<LeadField, string>>; values: LeadValues }
  | { ok: false; reason: "rate"; retryAfter: number; values: LeadValues };

const HOUR = 60 * 60_000;

/**
 * Validates and stores a landing lead. Honeypot hits look like a success to the
 * sender but are not stored, so bots get no signal to adapt.
 */
export async function submitLead(formData: FormData, { ip, source = "tienda-online" }: { ip: string; source?: string }): Promise<SubmitLeadResult> {
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { ok: true, spam: true };
  }

  const parsed = parseLeadForm(formData);
  if (!parsed.ok) return { ok: false, reason: "invalid", fieldErrors: parsed.fieldErrors, values: parsed.values };
  const data = parsed.data;

  const byIp = rateLimit(`lead:ip:${ip}`, 5, HOUR);
  const byContact = rateLimit(`lead:contact:${data.email}:${data.whatsapp}`, 3, 24 * HOUR);
  if (!byIp.ok || !byContact.ok) {
    return { ok: false, reason: "rate", retryAfter: Math.max(byIp.retryAfter, byContact.retryAfter), values: readLeadValues(formData) };
  }

  const lead = await db.lead.create({
    data: { ...data, source, ip: ip === "local" ? null : ip.slice(0, 64) },
    select: { id: true, businessName: true, industry: true, instagram: true },
  });
  return { ok: true, spam: false, lead: { ...lead, industry: data.industry } };
}
