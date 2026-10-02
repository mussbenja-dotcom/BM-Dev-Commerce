import "server-only";
import { db } from "@/lib/db";
import { Prisma, type StorePlan, type StoreStatus } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { encryptSecret } from "@/lib/crypto";
import { AdminError } from "@/lib/services/admin/common";
import { provisionStore, type NewStoreInput } from "@/lib/services/provision";
import { tempPassword } from "./rules";
import { seedDemoStore } from "../../../../prisma/seed-data/demo";
import { SEED_STORES } from "../../../../prisma/seed-data/stores";

const isUnique = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** Creates a store and its owner with a temporary password that is returned once and only stored hashed. */
export async function createStore(input: NewStoreInput, opts: { leadId?: string | null } = {}) {
  const [slugTaken, emailTaken, domainTaken] = await Promise.all([
    db.store.findUnique({ where: { slug: input.slug }, select: { id: true } }),
    db.user.findUnique({ where: { email: input.ownerEmail }, select: { id: true } }),
    input.domain ? db.storeDomain.findUnique({ where: { hostname: input.domain }, select: { id: true } }) : null,
  ]);
  const errors: Record<string, string> = {};
  if (slugTaken) errors.slug = "Ya hay una tienda con esa dirección.";
  if (emailTaken) errors.ownerEmail = "Ese email ya tiene un usuario.";
  if (domainTaken) errors.domain = "Ese dominio ya está asignado a otra tienda.";
  if (Object.keys(errors).length) throw new AdminError(Object.values(errors)[0], errors);

  const password = tempPassword();
  try {
    const { store, owner } = await provisionStore(db, { ...input, passwordHash: await hashPassword(password), status: "DRAFT" });
    if (opts.leadId) await db.lead.updateMany({ where: { id: opts.leadId }, data: { storeId: store.id, status: "WON" } });
    return { storeId: store.id, slug: store.slug, name: store.name, ownerEmail: owner.email, tempPassword: password };
  } catch (err) {
    if (isUnique(err)) throw new AdminError("La dirección, el dominio o el email ya están en uso.");
    throw err;
  }
}

export async function updateStore(storeId: string, input: { name: string; status: StoreStatus; plan: StorePlan; notes: string | null }) {
  const r = await db.store.updateMany({ where: { id: storeId }, data: input });
  if (!r.count) throw new AdminError("No encontramos la tienda.");
}

export async function addDomain(storeId: string, hostname: string, primary: boolean) {
  const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true } });
  if (!store) throw new AdminError("No encontramos la tienda.");
  const taken = await db.storeDomain.findUnique({ where: { hostname }, select: { storeId: true } });
  if (taken) throw new AdminError(taken.storeId === storeId ? "La tienda ya tiene ese dominio." : "Ese dominio ya está asignado a otra tienda.", { hostname: "Ya está en uso." });
  try {
    await db.$transaction(async (tx) => {
      const count = await tx.storeDomain.count({ where: { storeId } });
      const makePrimary = primary || count === 0;
      if (makePrimary) await tx.storeDomain.updateMany({ where: { storeId }, data: { isPrimary: false } });
      await tx.storeDomain.create({ data: { storeId, hostname, isPrimary: makePrimary } });
    });
  } catch (err) {
    if (isUnique(err)) throw new AdminError("Ese dominio ya está asignado.", { hostname: "Ya está en uso." });
    throw err;
  }
}

export async function setPrimaryDomain(storeId: string, domainId: string) {
  await db.$transaction(async (tx) => {
    const domain = await tx.storeDomain.findFirst({ where: { id: domainId, storeId }, select: { id: true } });
    if (!domain) throw new AdminError("No encontramos el dominio.");
    await tx.storeDomain.updateMany({ where: { storeId }, data: { isPrimary: false } });
    await tx.storeDomain.update({ where: { id: domain.id }, data: { isPrimary: true } });
  });
}

/** A domain mapping is configuration (no history points to it), so it can be removed. */
export async function removeDomain(storeId: string, domainId: string) {
  return db.$transaction(async (tx) => {
    const domain = await tx.storeDomain.findFirst({ where: { id: domainId, storeId } });
    if (!domain) throw new AdminError("No encontramos el dominio.");
    await tx.storeDomain.delete({ where: { id: domain.id } });
    if (domain.isPrimary) {
      const next = await tx.storeDomain.findFirst({ where: { storeId }, orderBy: { createdAt: "asc" } });
      if (next) await tx.storeDomain.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    return domain.hostname;
  });
}

export async function setDomainVerified(storeId: string, domainId: string, verified: boolean) {
  const r = await db.storeDomain.updateMany({ where: { id: domainId, storeId }, data: { verified } });
  if (!r.count) throw new AdminError("No encontramos el dominio.");
}

export async function addStoreUser(storeId: string, input: { name: string; email: string }) {
  const store = await db.store.findUnique({ where: { id: storeId }, select: { id: true, isDemo: true } });
  if (!store) throw new AdminError("No encontramos la tienda.");
  if (await db.user.findUnique({ where: { email: input.email }, select: { id: true } })) throw new AdminError("Ese email ya tiene un usuario.", { email: "Ya está en uso." });
  const password = tempPassword();
  try {
    const user = await db.user.create({
      data: { ...input, storeId, role: "STORE_ADMIN", isDemo: store.isDemo, passwordHash: await hashPassword(password) },
      select: { id: true, email: true },
    });
    return { ...user, tempPassword: password };
  } catch (err) {
    if (isUnique(err)) throw new AdminError("Ese email ya tiene un usuario.", { email: "Ya está en uso." });
    throw err;
  }
}

/** Only store users: a superadmin account is never managed from a store page. */
async function storeUser(storeId: string, userId: string) {
  const user = await db.user.findFirst({ where: { id: userId, storeId, role: { not: "SUPERADMIN_BMDEV" } }, select: { id: true, email: true } });
  if (!user) throw new AdminError("No encontramos el usuario.");
  return user;
}

/** New temporary password; every open session of that user is closed. */
export async function resetUserPassword(storeId: string, userId: string) {
  const user = await storeUser(storeId, userId);
  const password = tempPassword();
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);
  return { email: user.email, tempPassword: password };
}

/** Users are deactivated, never deleted (audit logs point to them). */
export async function setUserActive(storeId: string, userId: string, active: boolean) {
  const user = await storeUser(storeId, userId);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { active } }),
    ...(active ? [] : [db.session.deleteMany({ where: { userId: user.id } })]),
  ]);
  return user.email;
}

// ---------------------------------------------------------------- Mercado Pago

export type MercadoPagoInput = { mode: "DEMO" | "SANDBOX" | "PRODUCTION"; publicKey: string | null; accessToken: string | null; clear: boolean };

/**
 * Stores a store's own Mercado Pago credentials. The access token is encrypted
 * (ENCRYPTION_KEY) and never read back: an empty field keeps the saved one.
 */
export async function setMercadoPagoCredentials(storeId: string, input: MercadoPagoInput) {
  const current = await db.storeSettings.findUnique({ where: { storeId }, select: { mpAccessTokenEnc: true } });
  if (!current) throw new AdminError("No encontramos la tienda.");
  if (input.clear) {
    await db.storeSettings.update({ where: { storeId }, data: { mpMode: "DEMO", mpPublicKey: null, mpAccessTokenEnc: null } });
    return { mode: "DEMO" as const, hasToken: false };
  }
  const hasToken = !!input.accessToken || !!current.mpAccessTokenEnc;
  if (input.mode !== "DEMO" && !hasToken) throw new AdminError("Para cobrar con Mercado Pago cargá el Access Token.", { accessToken: "Falta el Access Token." });
  if (input.mode !== "DEMO" && !input.publicKey) throw new AdminError("Cargá la Public Key.", { publicKey: "Falta la Public Key." });
  await db.storeSettings.update({
    where: { storeId },
    data: {
      mpMode: input.mode,
      mpPublicKey: input.publicKey,
      ...(input.accessToken ? { mpAccessTokenEnc: encryptSecret(input.accessToken) } : {}),
    },
  });
  return { mode: input.mode, hasToken };
}

// ---------------------------------------------------------------- demo reset

/**
 * Rebuilds a demo store from its curated seed (catalogue, banners, coupons,
 * orders). Only stores flagged isDemo with a seed definition can be reset.
 * The store gets a new id; open demo sessions are closed.
 */
export async function resetDemoStore(storeId: string) {
  const store = await db.store.findUnique({ where: { id: storeId }, select: { slug: true, isDemo: true } });
  if (!store) throw new AdminError("No encontramos la tienda.");
  if (!store.isDemo) throw new AdminError("Solo se pueden restablecer tiendas demo.");
  const definition = SEED_STORES.find((s) => s.slug === store.slug);
  if (!definition) throw new AdminError("Esta demo no tiene datos de ejemplo para restablecer.");
  const password = process.env.DEMO_ADMIN_PASSWORD || tempPassword();
  const newId = await seedDemoStore(db, definition, await hashPassword(password), () => {});
  if (!newId) throw new AdminError("No se pudo restablecer la demo.");
  return { storeId: newId, slug: store.slug };
}
