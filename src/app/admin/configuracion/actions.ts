"use server";

import { z } from "zod";
import { requireStoreSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { ok, revalidateStore, run, zf } from "@/lib/services/admin/common";
import type { ActionResult, ActionState } from "@/lib/services/admin/types";
import type { Actor } from "@/lib/services/admin/orders";
import { saveShippingMethod, updateContact, updateFreeShipping, updatePayments, updatePolicies, updateStoreInfo } from "@/lib/services/admin/settings";

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};
const read = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, str(fd, k)]));

async function actor(): Promise<Actor> {
  const session = await requireStoreSession();
  return { storeId: session.storeId, userId: session.userId };
}

async function done(a: Actor, section: string, message: string, meta?: Record<string, unknown>): Promise<ActionResult> {
  await audit({ action: `settings.${section}`, storeId: a.storeId, userId: a.userId, entity: "store", entityId: a.storeId, meta });
  await revalidateStore(a.storeId, { storefront: true });
  return ok(message);
}

const digitsOrNull = (max: number) => zf.optional(max).transform((v) => (v ? v.replace(/\D/g, "") || null : null));

const infoSchema = z.object({
  name: zf.required(80, "Ingresá el nombre de la tienda."),
  tagline: zf.optional(120),
  description: zf.optional(1000),
  announcement: zf.optional(140),
  footerText: zf.optional(300),
  logoUrl: zf.optionalUrl(),
  faviconUrl: zf.optionalUrl(),
  seoTitle: zf.optional(70),
  seoDescription: zf.optional(160),
});

export async function saveStoreInfoAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    await updateStoreInfo(a, infoSchema.parse(read(fd, Object.keys(infoSchema.shape))));
    return done(a, "info", "Datos de la tienda guardados.");
  });
}

const handle = zf.optional(60).transform((v) => (v ? v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?[^/]+\//i, "").replace(/\/.*$/, "") || null : null));

const contactSchema = z.object({
  whatsapp: digitsOrNull(30).refine((v) => v === null || (v.length >= 8 && v.length <= 15), "Ingresá el WhatsApp con código de área."),
  email: zf.optional(120).refine((v) => v === null || z.email().safeParse(v).success, "Ingresá un email válido."),
  phone: zf.optional(30),
  instagram: handle,
  facebook: handle,
  tiktok: handle,
  address: zf.optional(160),
  city: zf.optional(80),
  province: zf.optional(40),
  hours: zf.optional(160),
});

export async function saveContactAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    await updateContact(a, contactSchema.parse(read(fd, Object.keys(contactSchema.shape))));
    return done(a, "contact", "Contacto guardado.");
  });
}

const paymentsSchema = z.object({
  enableMercadoPago: zf.bool,
  enableTransfer: zf.bool,
  enableCash: zf.bool,
  enableWhatsappOrder: zf.bool,
  transferDiscountPct: zf.int(0, 50, "Usá un descuento entre 0 y 50 %."),
  maxInstallments: zf.int(1, 24, "Usá entre 1 y 24 cuotas."),
  bankName: zf.optional(60),
  bankHolder: zf.optional(80),
  bankCbu: digitsOrNull(30),
  bankAlias: zf.optional(20),
  bankCuit: digitsOrNull(20),
});

export async function savePaymentsAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const raw = read(fd, Object.keys(paymentsSchema.shape));
    const input = paymentsSchema.parse({ ...raw, transferDiscountPct: raw.transferDiscountPct || "0", maxInstallments: raw.maxInstallments || "1" });
    await updatePayments(a, input);
    return done(a, "payments", "Medios de pago guardados.", { mercadoPago: input.enableMercadoPago, transfer: input.enableTransfer, cash: input.enableCash, whatsapp: input.enableWhatsappOrder });
  });
}

const policiesSchema = z.object({ shippingPolicy: zf.optional(5000), returnsPolicy: zf.optional(5000), privacyPolicy: zf.optional(5000) });

export async function savePoliciesAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    await updatePolicies(a, policiesSchema.parse(read(fd, Object.keys(policiesSchema.shape))));
    return done(a, "policies", "Políticas guardadas.");
  });
}

export async function saveFreeShippingAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const threshold = zf.optionalMoney("Ingresá un monto válido o dejalo vacío.").parse(str(fd, "freeShippingThreshold"));
    await updateFreeShipping(a, threshold);
    return done(a, "free_shipping", threshold ? "Envío gratis actualizado." : "Envío gratis desactivado.", { threshold });
  });
}

const shippingSchema = z.object({
  name: zf.required(60, "Ingresá un nombre, ej. Envío a domicilio."),
  description: zf.optional(200),
  type: z.enum(["SHIPPING", "PICKUP"], { message: "Elegí el tipo." }),
  price: zf.money("Ingresá el costo (0 si es gratis)."),
  provinces: z.array(z.string().max(40)).max(24),
  estimatedDays: zf.optional(60),
  active: zf.bool,
  position: zf.int(0, 999, "Usá un número entre 0 y 999."),
});

export async function saveShippingMethodAction(_prev: ActionState, fd: FormData): Promise<ActionResult> {
  const a = await actor(); // outside run(): its redirect must not be caught
  return run(async () => {
    const methodId = str(fd, "methodId").slice(0, 40) || null;
    const input = shippingSchema.parse({
      ...read(fd, ["name", "description", "type", "price", "estimatedDays", "active"]),
      position: str(fd, "position") || "0",
      provinces: fd.getAll("provinces").filter((v): v is string => typeof v === "string"),
    });
    const r = await saveShippingMethod(a, methodId, input);
    await audit({ action: methodId ? "shipping.update" : "shipping.create", storeId: a.storeId, userId: a.userId, entity: "shippingMethod", entityId: r.id });
    await revalidateStore(a.storeId, { storefront: true });
    return ok(methodId ? "Forma de entrega guardada." : "Forma de entrega creada.", { id: r.id });
  });
}
