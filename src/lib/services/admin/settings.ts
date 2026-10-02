import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { ARGENTINE_PROVINCES } from "@/lib/services/checkout";
import { AdminError } from "./common";
import type { Actor } from "./orders";
import { mercadoPagoAvailable, paymentSettingsErrors, type PaymentSettingsInput } from "./settings-rules";

export type StoreInfoInput = {
  name: string;
  tagline: string | null;
  description: string | null;
  announcement: string | null;
  footerText: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};
export type ContactInput = {
  whatsapp: string | null; email: string | null; phone: string | null; instagram: string | null; facebook: string | null;
  tiktok: string | null; address: string | null; city: string | null; province: string | null; hours: string | null;
};
export type PaymentsInput = PaymentSettingsInput & { transferDiscountPct: number; maxInstallments: number; bankName: string | null };
export type PoliciesInput = { shippingPolicy: string | null; returnsPolicy: string | null; privacyPolicy: string | null };
export type ShippingMethodInput = {
  name: string; description: string | null; type: "SHIPPING" | "PICKUP"; price: number; provinces: string[];
  estimatedDays: string | null; active: boolean; position: number;
};

export async function getStoreSettings(storeId: string) {
  const store = await db.store.findUniqueOrThrow({
    where: { id: storeId },
    select: {
      id: true, name: true, slug: true, isDemo: true,
      settings: true,
      shippingMethods: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
  });
  const { mpAccessTokenEnc, ...settings } = store.settings ?? ({} as NonNullable<typeof store.settings>);
  const hasToken = !!mpAccessTokenEnc;
  return {
    store: { name: store.name, slug: store.slug, isDemo: store.isDemo },
    // The encrypted token never leaves the server; the UI only needs to know if it exists.
    settings: store.settings ? settings : null,
    mercadoPago: { mode: store.settings?.mpMode ?? "DEMO", hasToken, available: mercadoPagoAvailable({ isDemo: store.isDemo, mpMode: store.settings?.mpMode ?? "DEMO", hasToken }) },
    shippingMethods: store.shippingMethods,
  };
}

async function writeSettings(storeId: string, data: Omit<Prisma.StoreSettingsUncheckedCreateInput, "storeId" | "id">) {
  await db.storeSettings.upsert({ where: { storeId }, update: data, create: { ...data, storeId } });
}

export async function updateStoreInfo(actor: Actor, input: StoreInfoInput) {
  const { name, ...settings } = input;
  await db.$transaction(async (tx) => {
    await tx.store.update({ where: { id: actor.storeId }, data: { name } });
    await tx.storeSettings.upsert({ where: { storeId: actor.storeId }, update: settings, create: { ...settings, storeId: actor.storeId } });
  });
}

export async function updateContact(actor: Actor, input: ContactInput) {
  if (input.province && !ARGENTINE_PROVINCES.includes(input.province)) throw new AdminError("Elegí una provincia de la lista.", { province: "Elegí una provincia." });
  await writeSettings(actor.storeId, input);
}

export async function updatePayments(actor: Actor, input: PaymentsInput) {
  const current = await db.store.findUniqueOrThrow({ where: { id: actor.storeId }, select: { isDemo: true, settings: { select: { mpMode: true, mpAccessTokenEnc: true } } } });
  const available = mercadoPagoAvailable({ isDemo: current.isDemo, mpMode: current.settings?.mpMode ?? "DEMO", hasToken: !!current.settings?.mpAccessTokenEnc });
  const errors = paymentSettingsErrors(input, available);
  if (Object.keys(errors).length) throw new AdminError(Object.keys(errors).length > 1 ? "Revisá los campos marcados." : Object.values(errors)[0], errors);
  await writeSettings(actor.storeId, input);
  return { mercadoPagoAvailable: available };
}

export async function updatePolicies(actor: Actor, input: PoliciesInput) {
  await writeSettings(actor.storeId, input);
}

export async function updateFreeShipping(actor: Actor, threshold: number | null) {
  await writeSettings(actor.storeId, { freeShippingThreshold: threshold });
}

export async function saveShippingMethod(actor: Actor, methodId: string | null, input: ShippingMethodInput) {
  const unknown = input.provinces.filter((p) => !ARGENTINE_PROVINCES.includes(p));
  if (unknown.length) throw new AdminError("Elegí provincias de la lista.", { provinces: "Elegí provincias de la lista." });
  // Pickup has no delivery zone.
  const data = input.type === "PICKUP" ? { ...input, provinces: [] } : input;
  if (methodId) {
    const r = await db.shippingMethod.updateMany({ where: { id: methodId, storeId: actor.storeId }, data });
    if (!r.count) throw new AdminError("No encontramos la forma de entrega.");
    return { id: methodId };
  }
  return db.shippingMethod.create({ data: { ...data, storeId: actor.storeId }, select: { id: true } });
}
