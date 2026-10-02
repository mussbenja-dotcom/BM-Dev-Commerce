"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperadmin, setSupportStore } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ok, run, zf } from "@/lib/services/admin/common";
import type { ActionResult, ActionState } from "@/lib/services/admin/types";
import { newStoreSchema } from "@/lib/services/provision";
import { hostnameSchema, idSchema, PLANS, STATUSES } from "@/lib/services/superadmin/constants";
import { LEAD_STATUSES } from "@/lib/services/superadmin/rules";
import { updateLead } from "@/lib/services/superadmin/leads";
import {
  addDomain, addStoreUser, createStore, removeDomain, resetUserPassword, setDomainVerified, setPrimaryDomain, setUserActive, updateStore,
} from "@/lib/services/superadmin/stores";

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

async function log(userId: string, action: string, entity: string, entityId: string, storeId?: string | null, meta?: Record<string, unknown>) {
  await audit({ action, userId, storeId: storeId ?? null, entity, entityId, meta });
}

// ---------------------------------------------------------------- leads

const leadSchema = z.object({ leadId: idSchema, status: z.enum(LEAD_STATUSES, { message: "Elegí un estado." }), notes: zf.optional(2000) });

export async function updateLeadAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const s = await requireSuperadmin(); // outside run(): its redirect must not be caught
  return run(async () => {
    const input = leadSchema.parse({ leadId: str(fd, "leadId"), status: str(fd, "status"), notes: str(fd, "notes") });
    await updateLead(input.leadId, { status: input.status, notes: input.notes });
    await log(s.userId, "lead.update", "lead", input.leadId, null, { status: input.status });
    revalidatePath("/superadmin", "layout");
    return ok("Solicitud actualizada.");
  });
}

// ---------------------------------------------------------------- stores

export async function createStoreAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const s = await requireSuperadmin(); // outside run(): its redirect must not be caught
  return run(async () => {
    const input = newStoreSchema.parse({
      name: str(fd, "name"), slug: str(fd, "slug"), domain: str(fd, "domain"), ownerEmail: str(fd, "ownerEmail"), ownerName: str(fd, "ownerName"),
      industry: str(fd, "industry"), template: str(fd, "template"), plan: str(fd, "plan") || "ESENCIAL", whatsapp: str(fd, "whatsapp") || undefined,
    });
    const leadId = str(fd, "leadId").slice(0, 40) || null;
    const r = await createStore(input, { leadId });
    await log(s.userId, "store.create", "store", r.storeId, r.storeId, { slug: r.slug, leadId });
    revalidatePath("/superadmin", "layout");
    return ok(`Tienda ${r.name} creada en borrador.`, { id: r.storeId, credentials: { email: r.ownerEmail, password: r.tempPassword } });
  });
}

const storeSchema = z.object({
  storeId: idSchema,
  name: zf.required(60, "Ingresá el nombre."),
  status: z.enum(STATUSES, { message: "Elegí un estado." }),
  plan: z.enum(PLANS, { message: "Elegí un plan." }),
  notes: zf.optional(2000),
});

export async function updateStoreAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const s = await requireSuperadmin(); // outside run(): its redirect must not be caught
  return run(async () => {
    const input = storeSchema.parse({ storeId: str(fd, "storeId"), name: str(fd, "name"), status: str(fd, "status"), plan: str(fd, "plan"), notes: str(fd, "notes") });
    const { storeId, ...data } = input;
    await updateStore(storeId, data);
    await log(s.userId, "store.update", "store", storeId, storeId, { status: data.status, plan: data.plan });
    revalidatePath("/superadmin", "layout");
    const store = await db.store.findUnique({ where: { id: storeId }, select: { slug: true } });
    if (store) revalidatePath(`/s/${store.slug}`, "layout");
    return ok("Tienda actualizada.");
  });
}

export async function addDomainAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const s = await requireSuperadmin(); // outside run(): its redirect must not be caught
  return run(async () => {
    const storeId = idSchema.parse(str(fd, "storeId"));
    const hostname = z.object({ hostname: hostnameSchema }).parse({ hostname: str(fd, "hostname") }).hostname;
    await addDomain(storeId, hostname, str(fd, "primary") === "on");
    await log(s.userId, "domain.add", "store", storeId, storeId, { hostname });
    revalidatePath("/superadmin", "layout");
    return ok(`Dominio ${hostname} agregado. Falta apuntar el DNS y marcarlo como verificado.`);
  });
}

const domainSchema = z.object({ storeId: idSchema, domainId: idSchema, op: z.enum(["primary", "remove", "verify", "unverify"]) });

export async function domainAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const s = await requireSuperadmin(); // outside run(): its redirect must not be caught
  return run(async () => {
    const { storeId, domainId, op } = domainSchema.parse({ storeId: str(fd, "storeId"), domainId: str(fd, "domainId"), op: str(fd, "op") });
    let message = "Dominio actualizado.";
    if (op === "primary") await setPrimaryDomain(storeId, domainId);
    if (op === "verify" || op === "unverify") await setDomainVerified(storeId, domainId, op === "verify");
    if (op === "remove") message = `Dominio ${await removeDomain(storeId, domainId)} quitado.`;
    await log(s.userId, `domain.${op}`, "store", storeId, storeId, { domainId });
    revalidatePath("/superadmin", "layout");
    return ok(message);
  });
}

const newUserSchema = z.object({
  storeId: idSchema,
  name: zf.required(80, "Ingresá el nombre."),
  email: z.string().trim().toLowerCase().max(120).pipe(z.email("Ingresá un email válido.")),
});

export async function addStoreUserAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const s = await requireSuperadmin(); // outside run(): its redirect must not be caught
  return run(async () => {
    const { storeId, ...input } = newUserSchema.parse({ storeId: str(fd, "storeId"), name: str(fd, "name"), email: str(fd, "email") });
    const user = await addStoreUser(storeId, input);
    await log(s.userId, "user.create", "user", user.id, storeId, { email: user.email });
    revalidatePath("/superadmin", "layout");
    return ok("Usuario creado.", { credentials: { email: user.email, password: user.tempPassword } });
  });
}

const userOpSchema = z.object({ storeId: idSchema, userId: idSchema, op: z.enum(["reset", "activate", "deactivate"]) });

export async function storeUserAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const s = await requireSuperadmin(); // outside run(): its redirect must not be caught
  return run(async () => {
    const { storeId, userId, op } = userOpSchema.parse({ storeId: str(fd, "storeId"), userId: str(fd, "userId"), op: str(fd, "op") });
    if (op === "reset") {
      const r = await resetUserPassword(storeId, userId);
      await log(s.userId, "user.reset_password", "user", userId, storeId);
      return ok("Contraseña nueva generada. Se cerraron sus sesiones abiertas.", { credentials: { email: r.email, password: r.tempPassword } });
    }
    const email = await setUserActive(storeId, userId, op === "activate");
    await log(s.userId, `user.${op}`, "user", userId, storeId);
    revalidatePath("/superadmin", "layout");
    return ok(op === "activate" ? `${email} puede volver a ingresar.` : `${email} ya no puede ingresar.`);
  });
}

// ---------------------------------------------------------------- support mode

export async function enterSupportAction(fd: FormData) {
  const s = await requireSuperadmin();
  const storeId = idSchema.safeParse(str(fd, "storeId"));
  if (!storeId.success) redirect("/superadmin/tiendas");
  const store = await db.store.findUnique({ where: { id: storeId.data }, select: { id: true } });
  if (!store) redirect("/superadmin/tiendas");
  await setSupportStore(s.sessionId, store.id);
  await log(s.userId, "support.enter", "store", store.id, store.id);
  redirect("/admin");
}

export async function exitSupportAction() {
  const s = await requireSuperadmin();
  const storeId = s.supportMode ? s.storeId : null;
  await setSupportStore(s.sessionId, null);
  if (storeId) await log(s.userId, "support.exit", "store", storeId, storeId);
  redirect(storeId ? `/superadmin/tiendas/${storeId}` : "/superadmin");
}
