import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import type { UserRole } from "@/generated/prisma/client";

const COOKIE = "bm_session";
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const DEMO_TTL_MS = 1000 * 60 * 60 * 4; // demo sessions: 4 hours

export type SessionUser = {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  isDemo: boolean;
  /** Store the user is operating on (own store, or support target for superadmin). */
  storeId: string | null;
  supportMode: boolean;
};

export async function createSession(userId: string, opts: { demo?: boolean } = {}) {
  const token = randomToken(32);
  const h = await headers();
  const expiresAt = new Date(Date.now() + (opts.demo ? DEMO_TTL_MS : TTL_MS));
  await db.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
    },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE);
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { include: { store: { select: { status: true } } } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  const { user } = session;
  // A suspended store locks out its own staff (superadmin support access still works).
  if (user.role !== "SUPERADMIN_BMDEV" && user.store?.status === "SUSPENDED") return null;
  const supportMode = user.role === "SUPERADMIN_BMDEV" && !!session.supportStoreId;
  return {
    sessionId: session.id,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isDemo: user.isDemo,
    storeId: supportMode ? session.supportStoreId : user.storeId,
    supportMode,
  };
});

export async function setSupportStore(sessionId: string, storeId: string | null) {
  await db.session.update({ where: { id: sessionId }, data: { supportStoreId: storeId } });
}

/** For the merchant admin: returns the session scoped to exactly one store. */
export async function requireStoreSession(): Promise<SessionUser & { storeId: string }> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.storeId) redirect(session.role === "SUPERADMIN_BMDEV" ? "/superadmin" : "/login");
  return session as SessionUser & { storeId: string };
}

export async function requireSuperadmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SUPERADMIN_BMDEV") redirect("/admin");
  return session;
}
