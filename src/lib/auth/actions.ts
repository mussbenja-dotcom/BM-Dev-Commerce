"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, getSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { audit } from "@/lib/audit";

export type LoginState = { error?: string; email?: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(120).pipe(z.email()),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
});

// Same message for every failure: never reveal whether the email exists.
const INVALID = "Email o contraseña incorrectos.";

function safeNext(next: string | undefined, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: INVALID, email };

  const ip = await clientIp();
  const limit = rateLimit(`login:${ip}:${parsed.data.email}`, 8, 15 * 60_000);
  if (!limit.ok) {
    return { error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(limit.retryAfter / 60)} minutos.`, email };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    include: { store: { select: { status: true } } },
  });
  // Always run bcrypt to keep timing similar for unknown emails.
  const ok = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5f2ZUQ4fRqRMqwh1RSqNshi6CdV3m1e",
  );
  if (!user || !ok || !user.active) {
    await audit({ action: "auth.login_failed", meta: { email: parsed.data.email } });
    return { error: INVALID, email };
  }
  if (user.role !== "SUPERADMIN_BMDEV" && user.store?.status === "SUSPENDED") {
    return { error: "Esta tienda está suspendida. Contactá a BM Dev.", email };
  }

  await createSession(user.id, { demo: user.isDemo });
  await audit({ action: "auth.login", userId: user.id, storeId: user.storeId });
  redirect(safeNext(parsed.data.next, user.role === "SUPERADMIN_BMDEV" ? "/superadmin" : "/admin"));
}

/** One-click access to a demo store's panel. Only for stores flagged isDemo. */
export async function demoLoginAction(formData: FormData) {
  if (process.env.DEMO_LOGIN_ENABLED !== "true") redirect("/login");
  const slug = String(formData.get("slug") ?? "alma");
  const ip = await clientIp();
  if (!rateLimit(`demo-login:${ip}`, 20, 10 * 60_000).ok) redirect("/login?error=rate");

  const store = await db.store.findUnique({ where: { slug }, select: { id: true, isDemo: true } });
  if (!store?.isDemo) redirect("/login");
  const user = await db.user.findFirst({
    where: { storeId: store.id, isDemo: true, role: "STORE_OWNER", active: true },
    select: { id: true },
  });
  if (!user) redirect("/login");
  await createSession(user.id, { demo: true });
  redirect("/admin");
}

export async function logoutAction() {
  const session = await getSession();
  if (session) await audit({ action: "auth.logout", userId: session.userId, storeId: session.storeId });
  await destroySession();
  redirect("/login");
}
