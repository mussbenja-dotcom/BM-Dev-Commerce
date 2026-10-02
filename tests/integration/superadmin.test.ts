import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import { getLead, listLeads, updateLead } from "@/lib/services/superadmin/leads";
import {
  addDomain, addStoreUser, createStore, removeDomain, resetUserPassword, setPrimaryDomain, setUserActive, updateStore,
} from "@/lib/services/superadmin/stores";

const tag = randomUUID().slice(0, 8);
const storeIds: string[] = [];
const emails: string[] = [];
const leadIds: string[] = [];

async function newStore(label: string, leadId?: string) {
  const ownerEmail = `owner-${label}-${tag}@example.invalid`;
  emails.push(ownerEmail);
  const r = await createStore(
    { name: `Tienda ${label}`, slug: `qa-sa-${label}-${tag}`, ownerEmail, ownerName: "Dueña QA", industry: "Moda", template: "fashion", plan: "ESENCIAL" },
    { leadId },
  );
  storeIds.push(r.storeId);
  return r;
}

afterAll(async () => {
  await db.lead.deleteMany({ where: { id: { in: leadIds } } });
  await db.store.deleteMany({ where: { id: { in: storeIds } } });
  await db.user.deleteMany({ where: { email: { in: emails } } });
});

describe("superadmin", () => {
  it("creates a draft store from a lead with a hashed temporary password", async () => {
    const lead = await db.lead.create({
      data: { name: "Ana", businessName: `Lead ${tag}`, whatsapp: "1123456789", email: `lead-${tag}@example.invalid`, industry: "Moda", sellsOnline: "no", productCount: "hasta-20", needs: "nueva" },
    });
    leadIds.push(lead.id);
    const r = await newStore("lead", lead.id);
    expect(r.tempPassword).toMatch(/^[A-Za-z0-9]{14}$/);
    const store = await db.store.findUniqueOrThrow({ where: { id: r.storeId }, include: { users: true, theme: true, settings: true, categories: true } });
    expect(store).toMatchObject({ status: "DRAFT", isDemo: false });
    expect(store.theme).not.toBeNull();
    expect(store.categories.length).toBeGreaterThan(0);
    expect(store.users[0].passwordHash).not.toContain(r.tempPassword);
    expect(await bcrypt.compare(r.tempPassword, store.users[0].passwordHash)).toBe(true);
    expect(await getLead(lead.id)).toMatchObject({ status: "WON", storeId: r.storeId });

    await expect(newStore("lead")).rejects.toMatchObject({ fieldErrors: { slug: expect.any(String), ownerEmail: expect.any(String) } });
    await updateLead(lead.id, { status: "CONTACTED", notes: "Llamar el lunes" });
    expect((await listLeads({ status: "CONTACTED", q: `Lead ${tag}`, page: 1 })).rows.map((l) => l.id)).toEqual([lead.id]);
    await updateStore(r.storeId, { name: "Renombrada", status: "ACTIVE", plan: "PROFESIONAL", notes: "ok" });
    expect(await db.store.findUniqueOrThrow({ where: { id: r.storeId } })).toMatchObject({ name: "Renombrada", status: "ACTIVE", plan: "PROFESIONAL" });
  });

  it("manages domains without crossing stores", async () => {
    const [a, b] = [await newStore("dom-a"), await newStore("dom-b")];
    await addDomain(a.storeId, `a-${tag}.com.ar`, false);
    await addDomain(a.storeId, `www.a-${tag}.com.ar`, true);
    let domains = await db.storeDomain.findMany({ where: { storeId: a.storeId }, orderBy: { createdAt: "asc" } });
    expect(domains.map((d) => [d.hostname, d.isPrimary])).toEqual([[`a-${tag}.com.ar`, false], [`www.a-${tag}.com.ar`, true]]);
    await expect(addDomain(b.storeId, `a-${tag}.com.ar`, false)).rejects.toThrow("Ese dominio ya está asignado a otra tienda.");
    await expect(setPrimaryDomain(b.storeId, domains[0].id)).rejects.toThrow("No encontramos el dominio.");
    await expect(removeDomain(b.storeId, domains[0].id)).rejects.toThrow("No encontramos el dominio.");
    expect(await removeDomain(a.storeId, domains[1].id)).toBe(`www.a-${tag}.com.ar`);
    domains = await db.storeDomain.findMany({ where: { storeId: a.storeId } });
    expect(domains.map((d) => [d.hostname, d.isPrimary])).toEqual([[`a-${tag}.com.ar`, true]]);
  });

  it("adds users, resets passwords and deactivates them, only inside the store", async () => {
    const [a, b] = [await newStore("usr-a"), await newStore("usr-b")];
    const email = `staff-${tag}@example.invalid`;
    emails.push(email);
    const staff = await addStoreUser(a.storeId, { name: "Staff", email });
    expect(await db.user.findUniqueOrThrow({ where: { id: staff.id } })).toMatchObject({ role: "STORE_ADMIN", storeId: a.storeId });
    await expect(addStoreUser(a.storeId, { name: "Otra", email })).rejects.toMatchObject({ fieldErrors: { email: "Ya está en uso." } });

    await db.session.create({ data: { id: `qa-${randomUUID()}`, userId: staff.id, expiresAt: new Date(Date.now() + 60_000) } });
    const reset = await resetUserPassword(a.storeId, staff.id);
    const user = await db.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(await bcrypt.compare(reset.tempPassword, user.passwordHash)).toBe(true);
    expect(await db.session.count({ where: { userId: staff.id } })).toBe(0);

    await expect(resetUserPassword(b.storeId, staff.id)).rejects.toThrow("No encontramos el usuario.");
    await expect(setUserActive(b.storeId, staff.id, false)).rejects.toThrow("No encontramos el usuario.");
    await setUserActive(a.storeId, staff.id, false);
    expect((await db.user.findUniqueOrThrow({ where: { id: staff.id } })).active).toBe(false);
    expect(await db.user.count({ where: { id: staff.id } })).toBe(1);
  });
});
