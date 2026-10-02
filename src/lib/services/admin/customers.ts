import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE } from "./common";

export const CUSTOMER_SORTS = { recientes: "Más recientes", compras: "Más compraron", pedidos: "Más pedidos" } as const;
export type CustomerSort = keyof typeof CUSTOMER_SORTS;

const ORDER_BY: Record<CustomerSort, Prisma.CustomerOrderByWithRelationInput[]> = {
  recientes: [{ createdAt: "desc" }],
  compras: [{ totalSpent: "desc" }, { createdAt: "desc" }],
  pedidos: [{ ordersCount: "desc" }, { createdAt: "desc" }],
};

function searchWhere(storeId: string, q?: string): Prisma.CustomerWhereInput {
  const term = q?.trim();
  if (!term) return { storeId };
  return {
    storeId,
    OR: [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term } },
    ],
  };
}

export async function listCustomers(storeId: string, f: { q?: string; sort: CustomerSort; page: number }) {
  const where = searchWhere(storeId, f.q);
  const [total, rows, totals] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: ORDER_BY[f.sort],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true, ordersCount: true, totalSpent: true, createdAt: true,
        orders: { where: { storeId }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    db.customer.aggregate({ where: { storeId }, _count: true, _sum: { totalSpent: true } }),
  ]);
  return { total, rows, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), storeTotals: { customers: totals._count, spent: totals._sum.totalSpent ?? 0 } };
}

export async function getCustomer(storeId: string, customerId: string) {
  return db.customer.findFirst({
    where: { id: customerId, storeId },
    include: {
      addresses: { where: { storeId }, orderBy: { createdAt: "desc" } },
      orders: {
        where: { storeId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, number: true, createdAt: true, total: true, status: true, paymentStatus: true, paymentMethod: true },
      },
    },
  });
}

export async function exportCustomers(storeId: string) {
  return db.customer.findMany({
    where: { storeId },
    orderBy: { createdAt: "asc" },
    take: 50_000,
    select: { firstName: true, lastName: true, email: true, phone: true, ordersCount: true, totalSpent: true, createdAt: true },
  });
}
