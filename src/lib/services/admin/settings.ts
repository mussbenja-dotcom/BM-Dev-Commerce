import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { ARGENTINE_PROVINCES } from "@/lib/services/checkout";
import { AdminError } from "./common";
import type { Actor } from "./orders";
import { contrastRatio, readableOn } from "@/lib/color";
import { getTemplate, type FontKey, type HomeSection, type ThemeTokens } from "@/lib/templates";
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
export type PoliciesInput = { shippingPolicy: string | null; returnsPolicy: string | null; privacyPolicy: string | null; termsPolicy: string | null };
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
      theme: true,
      domains: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { hostname: true, isPrimary: true, verified: true } },
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
    theme: store.theme,
    domains: store.domains,
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

const BANK_FIELDS = ["bankName", "bankHolder", "bankCbu", "bankAlias", "bankCuit"] as const;

export async function updatePayments(actor: Actor, submitted: PaymentsInput) {
  const current = await db.store.findUniqueOrThrow({
    where: { id: actor.storeId },
    select: { isDemo: true, settings: { select: { mpMode: true, mpAccessTokenEnc: true, bankName: true, bankHolder: true, bankCbu: true, bankAlias: true, bankCuit: true } } },
  });
  // A demo session keeps the stored bank details whatever the form sends.
  const input: PaymentsInput = actor.isDemo
    ? { ...submitted, ...Object.fromEntries(BANK_FIELDS.map((k) => [k, current.settings?.[k] ?? null])) }
    : submitted;
  const available = mercadoPagoAvailable({ isDemo: current.isDemo, mpMode: current.settings?.mpMode ?? "DEMO", hasToken: !!current.settings?.mpAccessTokenEnc });
  const errors = paymentSettingsErrors(input, available);
  if (Object.keys(errors).length) throw new AdminError(Object.keys(errors).length > 1 ? "Revisá los campos marcados." : Object.values(errors)[0], errors);
  await writeSettings(actor.storeId, input);
  return { mercadoPagoAvailable: available, bankLocked: !!actor.isDemo };
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

// ---------------------------------------------------------------- appearance

export type ThemeInput = {
  template: string;
  applyTemplate: boolean;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingFont: FontKey;
  bodyFont: FontKey;
  radius: ThemeTokens["radius"];
  heroLayout: ThemeTokens["heroLayout"];
  cardStyle: ThemeTokens["cardStyle"];
  headingCase: ThemeTokens["headingCase"];
  homeSections: HomeSection[];
};

/**
 * Applying a template resets colors and fonts to its preset; otherwise the
 * merchant's colors are checked for legibility before saving.
 */
export async function updateTheme(actor: Actor, input: ThemeInput) {
  const current = await db.storeTheme.findUnique({ where: { storeId: actor.storeId }, select: { id: true } });
  if (!current) throw new AdminError("La tienda no tiene un tema configurado. Escribinos a BM Dev.");
  if (!input.homeSections.length) throw new AdminError("Elegí al menos una sección para el inicio.", { homeSections: "Elegí al menos una sección." });
  const template = getTemplate(input.template);
  if (input.applyTemplate) {
    await db.storeTheme.update({ where: { id: current.id }, data: { ...template.theme, template: template.key, homeSections: input.homeSections } });
    await db.store.update({ where: { id: actor.storeId }, data: { template: template.key } });
    return;
  }
  const errors: Record<string, string> = {};
  if (contrastRatio(input.textColor, input.backgroundColor) < 4.5) errors.textColor = "El texto no se lee bien sobre ese fondo. Elegí colores con más contraste.";
  if (contrastRatio(input.primaryColor, input.backgroundColor) < 1.6) errors.primaryColor = "El color principal casi no se distingue del fondo.";
  if (Object.keys(errors).length) throw new AdminError(Object.values(errors)[0], errors);
  await db.storeTheme.update({
    where: { id: current.id },
    data: {
      primaryColor: input.primaryColor, primaryContrast: readableOn(input.primaryColor), accentColor: input.accentColor,
      backgroundColor: input.backgroundColor, textColor: input.textColor, headingFont: input.headingFont, bodyFont: input.bodyFont,
      radius: input.radius, heroLayout: input.heroLayout, cardStyle: input.cardStyle, headingCase: input.headingCase,
      homeSections: input.homeSections, template: template.key,
    },
  });
  await db.store.update({ where: { id: actor.storeId }, data: { template: template.key } });
}
