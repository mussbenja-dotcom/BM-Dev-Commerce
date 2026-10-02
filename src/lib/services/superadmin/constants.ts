import { z } from "zod";
import type { StorePlan, StoreStatus } from "@/generated/prisma/enums";

/** Shared by server actions and client forms (no server-only imports here). */

export const STATUS_LABEL: Record<StoreStatus, string> = {
  ACTIVE: "Activa",
  DRAFT: "Borrador",
  SUSPENDED: "Suspendida",
};

export const PLAN_LABEL: Record<StorePlan, string> = {
  ESENCIAL: "Esencial",
  PROFESIONAL: "Profesional",
  A_MEDIDA: "A medida",
};

export const PLANS = ["ESENCIAL", "PROFESIONAL", "A_MEDIDA"] as const satisfies readonly StorePlan[];
export const STATUSES = ["ACTIVE", "DRAFT", "SUSPENDED"] as const satisfies readonly StoreStatus[];

export const INDUSTRIES = [
  "Moda",
  "Calzado",
  "Accesorios",
  "Cosmética",
  "Pastelería",
  "Alimentos",
  "Regalería",
  "Decoración",
  "Artesanías",
  "Viveros",
  "Ferretería",
  "Otro",
] as const;

export type ActionResult =
  | {
      ok: true;
      message?: string;
      /** Shown once to the superadmin; never stored in clear text. */
      tempPassword?: string;
      email?: string;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type CreateStoreResult =
  | { ok: true; storeId: string; slug: string; name: string; ownerEmail: string; tempPassword: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const HOSTNAME = /^(?=.{4,120}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** Accepts "https://www.Tienda.com.ar/algo" and keeps only the hostname. */
export function normalizeHostname(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export const hostnameSchema = z
  .string()
  .max(200)
  .transform(normalizeHostname)
  .pipe(z.string().regex(HOSTNAME, "Dominio inválido (ej: mitienda.com.ar)."));

export const idSchema = z.string().min(1).max(40);

export const newUserSchema = z.object({
  storeId: idSchema,
  name: z.string().trim().min(2, "Ingresá el nombre.").max(80),
  email: z.string().trim().toLowerCase().max(120).pipe(z.email("Email inválido.")),
});
