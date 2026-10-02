import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import type { ActionResult } from "./types";

export const ok = (message = "Guardado", extra: Partial<ActionResult> = {}): ActionResult => ({ ok: true, message, ...extra });
export const fail = (error: string, fieldErrors?: Record<string, string>): ActionResult => ({ ok: false, error, fieldErrors });

/** Thrown by services for expected, user-facing errors (Spanish message). */
export class AdminError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

/** Converts a ZodError into the first message per field. */
export function zodFail(error: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = error.issues[0]?.message ?? "Revisá los datos ingresados.";
  return fail(Object.keys(fieldErrors).length > 1 ? "Revisá los campos marcados." : first, fieldErrors);
}

/** Runs a service call and maps known errors to an ActionResult. */
export async function run(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AdminError) return fail(err.message, err.fieldErrors);
    if (err instanceof z.ZodError) return zodFail(err);
    console.error("[admin] action failed", err);
    return fail("No pudimos guardar los cambios. Probá de nuevo en unos segundos.");
  }
}

/** Reads FormData values as plain strings (missing keys become ""). */
export function formValues(fd: FormData, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = fd.get(k);
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}

/** Accepts "12500", "12.500", "$ 12.500" or "12500,50" (rounded). */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return NaN;
  return Math.round(Number(cleaned));
}

const MAX_MONEY = 1_000_000_000;

/** zod helpers for string inputs coming from forms. */
export const zf = {
  required: (max: number, msg: string) => z.string().trim().min(1, msg).max(max, `Máximo ${max} caracteres.`),
  optional: (max: number) =>
    z
      .string()
      .trim()
      .max(max, `Máximo ${max} caracteres.`)
      .transform((v) => (v === "" ? null : v)),
  bool: z.string().transform((v) => v === "on" || v === "true" || v === "1"),
  money: (msg = "Ingresá un monto válido.") =>
    z.string().transform((v, ctx) => {
      const n = parseMoney(v);
      if (n === null || Number.isNaN(n) || n < 0 || n > MAX_MONEY) {
        ctx.addIssue({ code: "custom", message: msg });
        return z.NEVER;
      }
      return n;
    }),
  optionalMoney: (msg = "Ingresá un monto válido.") =>
    z.string().transform((v, ctx) => {
      const n = parseMoney(v);
      if (n === null) return null;
      if (Number.isNaN(n) || n < 0 || n > MAX_MONEY) {
        ctx.addIssue({ code: "custom", message: msg });
        return z.NEVER;
      }
      return n;
    }),
  int: (min: number, max: number, msg: string) =>
    z.string().transform((v, ctx) => {
      const t = v.trim();
      const n = Number(t);
      if (t === "" || !Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: msg });
        return z.NEVER;
      }
      return n;
    }),
  optionalInt: (min: number, max: number, msg: string) =>
    z.string().transform((v, ctx) => {
      const t = v.trim();
      if (t === "") return null;
      const n = Number(t);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: msg });
        return z.NEVER;
      }
      return n;
    }),
  /** Absolute http(s) URL or a local /uploads path. */
  optionalUrl: (msg = "Ingresá una URL válida (https://…).") =>
    z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === "" || isImageUrl(v), msg)
      .transform((v) => (v === "" ? null : v)),
  /** Optional date from <input type="date"> (yyyy-mm-dd), Argentina time. */
  optionalDate: (endOfDay = false) =>
    z.string().transform((v, ctx) => {
      if (!v.trim()) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "Fecha inválida." });
        return z.NEVER;
      }
      return new Date(`${v}T${endOfDay ? "23:59:59" : "00:00:00"}-03:00`);
    }),
};

export function isImageUrl(v: string): boolean {
  if (v.startsWith("/uploads/") && !v.includes("..")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Refreshes the admin and (optionally) the public storefront of this store. */
export async function revalidateStore(storeId: string, opts: { storefront?: boolean } = {}) {
  revalidatePath("/admin", "layout");
  if (opts.storefront) {
    const store = await db.store.findUnique({ where: { id: storeId }, select: { slug: true } });
    if (store) revalidatePath(`/s/${store.slug}`, "layout");
  }
}

/** Argentina has no DST: UTC-3 all year. */
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

export function startOfDayAR(date: Date): Date {
  const local = new Date(date.getTime() - AR_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + AR_OFFSET_MS);
}

export function startOfMonthAR(date: Date): Date {
  const local = new Date(date.getTime() - AR_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + AR_OFFSET_MS);
}

/** yyyy-mm-dd key of a date in Argentina time. */
export function dayKeyAR(date: Date): string {
  return new Date(date.getTime() - AR_OFFSET_MS).toISOString().slice(0, 10);
}

export const PAGE_SIZE = 20;

export function pageParam(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}

export function strParam(raw: string | string[] | undefined, max = 80): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? "").trim().slice(0, max);
}
