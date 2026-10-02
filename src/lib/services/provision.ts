import { z } from "zod";
import type { PrismaClient, StorePlan } from "@/generated/prisma/client";
import { getTemplate, TEMPLATE_KEYS } from "@/lib/templates";
import { slugify } from "@/lib/slug";

/**
 * Store provisioning — shared by the superadmin "Nueva tienda" flow and the
 * seed script. Takes the Prisma client as a parameter so it can run outside
 * Next.js (seed) without importing server-only modules.
 */

export const RESERVED_SLUGS = new Set(["admin", "superadmin", "api", "login", "demo", "tienda-online", "s", "www", "app"]);

export const newStoreSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del negocio.").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "El slug debe tener al menos 3 caracteres.")
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones.")
    .refine((s) => !RESERVED_SLUGS.has(s), "Ese slug está reservado."),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, "Dominio inválido (ej: mitienda.com.ar).")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  ownerEmail: z.string().trim().toLowerCase().max(120).pipe(z.email("Email del propietario inválido.")),
  ownerName: z.string().trim().min(2).max(80),
  industry: z.string().trim().min(2).max(40),
  template: z.string().refine((t) => TEMPLATE_KEYS.includes(t), "Plantilla inválida."),
  plan: z.enum(["ESENCIAL", "PROFESIONAL", "A_MEDIDA"]).default("ESENCIAL"),
  whatsapp: z.string().trim().max(30).optional(),
});
export type NewStoreInput = z.infer<typeof newStoreSchema>;

export async function provisionStore(
  db: PrismaClient,
  input: NewStoreInput & { passwordHash: string; isDemo?: boolean; status?: "ACTIVE" | "DRAFT" },
) {
  const template = getTemplate(input.template);
  const t = template.theme;

  return db.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: {
        name: input.name,
        slug: input.slug,
        industry: input.industry,
        template: template.key,
        plan: input.plan as StorePlan,
        status: input.status ?? "DRAFT",
        isDemo: input.isDemo ?? false,
        settings: {
          create: {
            tagline: null,
            whatsapp: input.whatsapp ?? null,
            email: input.ownerEmail,
            enableMercadoPago: true,
            enableTransfer: true,
            enableCash: false,
            enableWhatsappOrder: true,
            transferDiscountPct: 10,
            maxInstallments: 3,
            freeShippingThreshold: 120000,
            shippingPolicy:
              "Despachamos dentro de las 48 hs hábiles de acreditado el pago. Recibís el código de seguimiento por email.",
            returnsPolicy:
              "Tenés 30 días para cambios. El producto debe estar sin uso y con su etiqueta. El primer cambio es sin cargo.",
            privacyPolicy:
              "Usamos tus datos solo para procesar tu pedido y contactarte por él. No compartimos tu información con terceros.",
            termsPolicy:
              "Los precios y el stock se confirman al finalizar la compra. El pedido queda registrado al confirmarse el pago o el medio elegido. Las promociones no son acumulables salvo que se indique lo contrario.",
          },
        },
        theme: {
          create: {
            template: template.key,
            primaryColor: t.primaryColor,
            primaryContrast: t.primaryContrast,
            accentColor: t.accentColor,
            backgroundColor: t.backgroundColor,
            surfaceColor: t.surfaceColor,
            textColor: t.textColor,
            mutedColor: t.mutedColor,
            borderColor: t.borderColor,
            headingFont: t.headingFont,
            bodyFont: t.bodyFont,
            radius: t.radius,
            heroLayout: t.heroLayout,
            cardStyle: t.cardStyle,
            headingCase: t.headingCase,
            homeSections: t.homeSections,
          },
        },
        domains: input.domain ? { create: { hostname: input.domain, isPrimary: true } } : undefined,
        categories: {
          create: template.starterCategories.map((name, i) => ({ name, slug: slugify(name), position: i })),
        },
        shippingMethods: {
          create: [
            {
              name: "Envío a domicilio AMBA",
              description: "Moto o correo, CABA y GBA",
              price: 6500,
              provinces: ["CABA", "Buenos Aires"],
              estimatedDays: "24 a 72 hs hábiles",
              position: 0,
            },
            {
              name: "Correo a todo el país",
              description: "Envío a sucursal o domicilio",
              price: 9800,
              provinces: [],
              estimatedDays: "3 a 7 días hábiles",
              position: 1,
            },
            {
              name: "Retiro en el local",
              description: "Coordinamos el horario por WhatsApp",
              type: "PICKUP",
              price: 0,
              position: 2,
            },
          ],
        },
        coupons: {
          create: { code: "BIENVENIDA10", description: "10% off en la primera compra", type: "PERCENT", value: 10 },
        },
      },
    });

    const owner = await tx.user.create({
      data: {
        email: input.ownerEmail,
        name: input.ownerName,
        passwordHash: input.passwordHash,
        role: "STORE_OWNER",
        storeId: store.id,
        isDemo: input.isDemo ?? false,
      },
    });

    return { store, owner };
  });
}
