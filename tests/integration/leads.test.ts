import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import { submitLead } from "@/lib/services/leads/submit";
import { HONEYPOT_FIELD } from "@/lib/services/leads/form";

const marker = `qa-lead-${randomUUID()}`;
const form = (extra: Record<string, string> = {}) => {
  const data = new FormData();
  const fields = {
    name: "Ana QA", businessName: marker, whatsapp: "11 2345 6789", email: `${randomUUID()}@example.invalid`, instagram: "@qa.tienda",
    industry: "Moda", sellsOnline: "no", productCount: "hasta-20", needs: "nueva", usesMercadoPago: "si", comment: "Prueba",
    ...extra,
  };
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const ip = () => `198.51.100.${Math.floor(Math.random() * 250)}-${randomUUID()}`;

afterAll(async () => {
  await db.lead.deleteMany({ where: { businessName: marker } });
});

describe("submitLead", () => {
  it("stores a validated lead with the server-normalized values", async () => {
    const result = await submitLead(form(), { ip: "203.0.113.7" });
    expect(result.ok && !result.spam).toBe(true);
    if (!result.ok || result.spam) return;
    const lead = await db.lead.findUniqueOrThrow({ where: { id: result.lead.id } });
    expect(lead).toMatchObject({ businessName: marker, whatsapp: "1123456789", instagram: "qa.tienda", usesMercadoPago: true, hasDomain: null, status: "NEW", source: "tienda-online", ip: "203.0.113.7" });
  });

  it("does not store honeypot or invalid submissions", async () => {
    const before = await db.lead.count({ where: { businessName: marker } });
    expect(await submitLead(form({ [HONEYPOT_FIELD]: "https://spam.example" }), { ip: ip() })).toEqual({ ok: true, spam: true });
    const invalid = await submitLead(form({ email: "no-es-email" }), { ip: ip() });
    expect(invalid).toMatchObject({ ok: false, reason: "invalid", fieldErrors: { email: "Ingresá un email válido." } });
    expect(await db.lead.count({ where: { businessName: marker } })).toBe(before);
  });

  it("rate limits repeated submissions from one IP", async () => {
    const sameIp = ip();
    for (let i = 0; i < 5; i++) expect((await submitLead(form(), { ip: sameIp })).ok).toBe(true);
    const blocked = await submitLead(form(), { ip: sameIp });
    expect(blocked).toMatchObject({ ok: false, reason: "rate" });
    if (!blocked.ok && blocked.reason === "rate") expect(blocked.values.businessName).toBe(marker);
  });

  it("rate limits the same contact across IPs", async () => {
    const email = `${randomUUID()}@example.invalid`;
    for (let i = 0; i < 3; i++) expect((await submitLead(form({ email }), { ip: ip() })).ok).toBe(true);
    expect(await submitLead(form({ email }), { ip: ip() })).toMatchObject({ ok: false, reason: "rate" });
  });
});
