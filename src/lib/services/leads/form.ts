import { z } from "zod";

/**
 * Lead form for the BM Dev E-commerce landing. Shared by the server action and
 * the client form, so nothing here may import server-only code.
 */

export const LEAD_INDUSTRIES = [
  "Moda",
  "Calzado",
  "Cosmética",
  "Pastelería",
  "Regalería",
  "Decoración",
  "Alimentos",
  "Comercio general",
  "Otro",
] as const;

export const SELLS_ONLINE = {
  no: "No, todavía no",
  redes: "Sí, por Instagram / WhatsApp",
  marketplace: "Sí, en Mercado Libre u otro marketplace",
  tienda: "Sí, ya tengo una tienda online",
} as const;

export const PRODUCT_COUNTS = {
  "hasta-20": "Hasta 20",
  "21-100": "Entre 21 y 100",
  "101-500": "Entre 101 y 500",
  "mas-500": "Más de 500",
} as const;

export const NEEDS = {
  nueva: "Una tienda online nueva",
  renovar: "Renovar o migrar mi tienda actual",
  pedidos: "Ordenar pedidos, stock y pagos",
  asesoramiento: "No sé bien, quiero asesoramiento",
} as const;

/** Hidden field that people never fill. Bots that fill every input reveal themselves. */
export const HONEYPOT_FIELD = "sitio_web";

export const LEAD_FIELDS = [
  "name", "businessName", "whatsapp", "email", "instagram", "industry",
  "sellsOnline", "productCount", "needs", "hasDomain", "usesMercadoPago", "comment",
] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];
export type LeadValues = Partial<Record<LeadField, string>>;

const keyOf = <T extends Record<string, string>>(options: T, message: string) =>
  z.string().refine((v): v is Extract<keyof T, string> => Object.hasOwn(options, v), { message });

const optionalYesNo = z
  .enum(["si", "no", ""], { message: "Elegí una opción." })
  .optional()
  .transform((v) => (v === "si" ? true : v === "no" ? false : null));

/** "@mi.tienda", "instagram.com/mi.tienda/" or "mi.tienda" -> "mi.tienda". */
export function normalizeInstagram(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "")
    .toLowerCase();
}

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre.").max(80, "Usá hasta 80 caracteres."),
  businessName: z.string().trim().min(2, "Ingresá el nombre de tu negocio.").max(100, "Usá hasta 100 caracteres."),
  whatsapp: z
    .string()
    .trim()
    .max(30, "Revisá el número.")
    .refine((v) => /^[+\d\s().-]*$/.test(v), "Usá solo números.")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 8 && v.length <= 15, "Ingresá un WhatsApp con código de área."),
  email: z.string().trim().toLowerCase().max(120, "Revisá el email.").pipe(z.email("Ingresá un email válido.")),
  instagram: z
    .string()
    .max(120)
    .transform(normalizeInstagram)
    .refine((v) => v === "" || /^[a-z0-9._]{1,30}$/.test(v), "Revisá el usuario de Instagram.")
    .transform((v) => v || null),
  industry: z.enum(LEAD_INDUSTRIES, { message: "Elegí un rubro." }),
  sellsOnline: keyOf(SELLS_ONLINE, "Elegí una opción."),
  productCount: keyOf(PRODUCT_COUNTS, "Elegí una cantidad aproximada."),
  needs: keyOf(NEEDS, "Contanos qué necesitás."),
  hasDomain: optionalYesNo,
  usesMercadoPago: optionalYesNo,
  comment: z.string().trim().max(1000, "Usá hasta 1000 caracteres.").transform((v) => v || null),
});
export type LeadInput = z.output<typeof leadSchema>;

export type LeadParseResult =
  | { ok: true; data: LeadInput }
  | { ok: false; fieldErrors: Partial<Record<LeadField, string>>; values: LeadValues };

export function readLeadValues(formData: FormData): LeadValues {
  const values: LeadValues = {};
  for (const field of LEAD_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value.slice(0, 2000);
  }
  return values;
}

export function parseLeadForm(formData: FormData): LeadParseResult {
  const values = readLeadValues(formData);
  const parsed = leadSchema.safeParse({
    ...values,
    name: values.name ?? "",
    businessName: values.businessName ?? "",
    whatsapp: values.whatsapp ?? "",
    email: values.email ?? "",
    instagram: values.instagram ?? "",
    industry: values.industry ?? "",
    sellsOnline: values.sellsOnline ?? "",
    productCount: values.productCount ?? "",
    needs: values.needs ?? "",
    comment: values.comment ?? "",
  });
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Partial<Record<LeadField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as LeadField;
    fieldErrors[field] ??= issue.message;
  }
  return { ok: false, fieldErrors, values };
}

/** Pre-filled message for BM Dev's sales WhatsApp. Blank lines stay for the visitor to complete. */
export function bmdevInterestMessage(details: { businessName?: string | null; industry?: string | null; instagram?: string | null } = {}) {
  const instagram = details.instagram ? `@${details.instagram.replace(/^@/, "")}` : "";
  return [
    "Hola, estuve viendo BM Dev E-commerce y me interesa tener una tienda online para mi negocio.",
    "",
    `Mi negocio se llama: ${details.businessName ?? ""}`.trimEnd(),
    `Rubro: ${details.industry ?? ""}`.trimEnd(),
    `Instagram: ${instagram}`.trimEnd(),
    "",
    "Quisiera recibir más información.",
  ].join("\n");
}

export type LeadFormState =
  | { status: "idle" }
  | { status: "success"; whatsappUrl: string | null }
  | { status: "error"; message?: string; fieldErrors?: Partial<Record<LeadField, string>>; values?: LeadValues };
