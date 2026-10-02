import "server-only";
import { db } from "@/lib/db";
import type { Prisma, StoreStatus } from "@/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;
export const since30d = () => new Date(Date.now() - 30 * DAY_MS);

/** Orders that count as sales (cancelled orders are excluded from GMV). */
const SALE: Prisma.OrderWhereInput = { status: { not: "CANCELLED" } };

export async function getPlatformTotals() {
  const from = since30d();
  const [byStatus, orders30d, gmv30d] = await Promise.all([
    db.store.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.count({ where: { createdAt: { gte: from } } }),
    db.order.aggregate({ where: { ...SALE, createdAt: { gte: from } }, _sum: { total: true } }),
  ]);
  const count = (s: StoreStatus) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  return {
    active: count("ACTIVE"),
    draft: count("DRAFT"),
    suspended: count("SUSPENDED"),
    total: byStatus.reduce((acc, r) => acc + r._count._all, 0),
    orders30d,
    gmv30d: gmv30d._sum.total ?? 0,
  };
}

export async function listStores(filter: { status?: StoreStatus; q?: string }) {
  const q = filter.q?.trim();
  const where: Prisma.StoreWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { domains: { some: { hostname: { contains: q, mode: "insensitive" } } } },
            { users: { some: { email: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  return db.store.findMany({
    where,
    orderBy: [{ isDemo: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      slug: true,
      industry: true,
      status: true,
      plan: true,
      isDemo: true,
      createdAt: true,
      domains: { where: { isPrimary: true }, take: 1, select: { hostname: true, verified: true } },
      users: { where: { role: "STORE_OWNER" }, orderBy: { createdAt: "asc" }, take: 1, select: { email: true } },
      _count: { select: { products: true, orders: { where: { createdAt: { gte: since30d() } } } } },
    },
  });
}
export type StoreListItem = Awaited<ReturnType<typeof listStores>>[number];

export async function getStoreDetail(id: string) {
  const store = await db.store.findUnique({
    where: { id },
    include: {
      settings: { select: { whatsapp: true, email: true, city: true, province: true, mpMode: true } },
      theme: { select: { primaryColor: true, accentColor: true, backgroundColor: true, headingFont: true } },
      domains: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      // Never select passwordHash.
      users: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, email: true, role: true, active: true, isDemo: true, lastLoginAt: true, createdAt: true },
      },
      _count: { select: { products: true, variants: true, images: true, orders: true, customers: true, categories: true } },
    },
  });
  if (!store) return null;

  const from = since30d();
  const [orders30d, gmv30d, lastOrder, activity] = await Promise.all([
    db.order.count({ where: { storeId: id, createdAt: { gte: from } } }),
    db.order.aggregate({ where: { ...SALE, storeId: id, createdAt: { gte: from } }, _sum: { total: true } }),
    db.order.findFirst({ where: { storeId: id }, orderBy: { createdAt: "desc" }, select: { createdAt: true, number: true } }),
    db.auditLog.findMany({
      where: { storeId: id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, createdAt: true, user: { select: { email: true } } },
    }),
  ]);

  return { store, orders30d, gmv30d: gmv30d._sum.total ?? 0, lastOrder, activity };
}
export type StoreDetail = NonNullable<Awaited<ReturnType<typeof getStoreDetail>>>;
