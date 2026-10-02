import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { formatPrice } from "@/lib/money";
import { AdminError, PAGE_SIZE, dayKeyAR, startOfDayAR, startOfMonthAR } from "./common";
import { canAdvance, canCancel, cancelNeedsRefundAck, manualPaymentTargets } from "./order-rules";

/** Who performs a change. storeId always comes from the server session. */
export type Actor = { storeId: string; userId: string };

const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Nuevo",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};
const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: "pendiente",
  PAID: "pagado",
  FAILED: "rechazado",
  REFUNDED: "reintegrado",
};

// ---------------------------------------------------------------- queries

export async function getDashboard(storeId: string, now = new Date()) {
  const today = startOfDayAR(now);
  const month = startOfMonthAR(now);
  const weekStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  const valid = { storeId, status: { not: "CANCELLED" as const } };

  const [todayAgg, monthAgg, newCount, awaitingPayment, lowStock, recent, week] = await Promise.all([
    db.order.aggregate({ where: { ...valid, createdAt: { gte: today } }, _sum: { total: true }, _count: true }),
    db.order.aggregate({ where: { ...valid, createdAt: { gte: month } }, _sum: { total: true }, _count: true }),
    db.order.count({ where: { storeId, status: "NEW" } }),
    db.order.count({ where: { ...valid, paymentStatus: "PENDING" } }),
    db.productVariant.findMany({
      where: { storeId, active: true, product: { active: true }, stock: { lte: db.productVariant.fields.lowStockAlert } },
      orderBy: { stock: "asc" },
      take: 6,
      select: { id: true, sku: true, stock: true, option1: true, option2: true, product: { select: { name: true } } },
    }),
    db.order.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: orderRowSelect,
    }),
    db.order.findMany({ where: { ...valid, createdAt: { gte: weekStart } }, select: { createdAt: true, total: true } }),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
    return { key: dayKeyAR(d), date: d, total: 0, count: 0 };
  });
  for (const o of week) {
    const day = days.find((d) => d.key === dayKeyAR(o.createdAt));
    if (day) {
      day.total += o.total;
      day.count += 1;
    }
  }

  return {
    today: { total: todayAgg._sum.total ?? 0, count: todayAgg._count },
    month: { total: monthAgg._sum.total ?? 0, count: monthAgg._count },
    newCount,
    awaitingPayment,
    lowStock,
    recent,
    days,
  };
}

const orderRowSelect = {
  id: true,
  number: true,
  createdAt: true,
  firstName: true,
  lastName: true,
  total: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  deliveryMethod: true,
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

export type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderRowSelect }>;

export type OrderFilters = {
  status?: OrderStatus;
  payment?: PaymentStatus;
  q?: string;
  page: number;
};

export async function listOrders(storeId: string, filters: OrderFilters) {
  const where: Prisma.OrderWhereInput = { storeId };
  if (filters.status) where.status = filters.status;
  if (filters.payment) where.paymentStatus = filters.payment;
  const q = filters.q?.trim();
  if (q) {
    const number = Number(q.replace(/^#/, ""));
    where.OR = [
      ...(Number.isInteger(number) && number > 0 && number < 2_000_000_000 ? [{ number }] : []),
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const [total, rows, counts] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: orderRowSelect,
    }),
    db.order.groupBy({ by: ["status"], where: { storeId }, _count: true }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Partial<Record<OrderStatus, number>>;
  return { total, rows, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), byStatus };
}

export async function getOrder(storeId: string, orderId: string) {
  return db.order.findFirst({
    where: { id: orderId, storeId },
    include: {
      items: { orderBy: { id: "asc" } },
      events: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" }, select: { id: true, provider: true, status: true, amount: true, externalId: true, createdAt: true } },
      customer: { select: { id: true, ordersCount: true, totalSpent: true } },
    },
  });
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

// -------------------------------------------------------------- mutations

type Tx = Prisma.TransactionClient;

/** Locks the order row so status, payment and cancellation changes serialize. */
async function lockOrder(tx: Tx, actor: Actor, orderId: string) {
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Order" WHERE id = ${orderId} AND "storeId" = ${actor.storeId} FOR UPDATE`;
  if (!locked.length) throw new AdminError("No encontramos el pedido.");
  return tx.order.findFirstOrThrow({
    where: { id: orderId, storeId: actor.storeId },
    include: { items: { select: { productId: true, variantId: true, quantity: true, productName: true, sku: true } } },
  });
}

export async function advanceOrderStatus(actor: Actor, orderId: string, to: OrderStatus) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, actor, orderId);
    if (!canAdvance(order.status, to)) {
      throw new AdminError(`El pedido está ${STATUS_LABEL[order.status].toLowerCase()} y no puede pasar a ${STATUS_LABEL[to].toLowerCase()}.`);
    }
    await tx.order.update({ where: { id: order.id, storeId: actor.storeId }, data: { status: to } });
    await tx.orderEvent.create({
      data: { storeId: actor.storeId, orderId: order.id, userId: actor.userId, type: "status", message: `Estado: ${STATUS_LABEL[order.status]} → ${STATUS_LABEL[to]}` },
    });
    return { number: order.number, from: order.status, to };
  });
}

/**
 * Cancels an order and returns its stock exactly once. Coupon use and the
 * customer's totals are reverted too. Paid orders are NOT refunded here: the
 * merchant must confirm they handle the refund (Mercado Pago or manual).
 */
export async function cancelOrder(actor: Actor, orderId: string, opts: { reason: string | null; refundAcknowledged: boolean }) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, actor, orderId);
    if (order.status === "CANCELLED") throw new AdminError("El pedido ya estaba cancelado. El stock no se repuso de nuevo.");
    if (!canCancel(order.status)) throw new AdminError("Un pedido entregado no se puede cancelar.");
    if (cancelNeedsRefundAck(order.paymentStatus) && !opts.refundAcknowledged) {
      throw new AdminError("Este pedido está pagado. Confirmá que vas a gestionar el reintegro antes de cancelarlo.", {
        refundAcknowledged: "Confirmá el reintegro.",
      });
    }

    let missing = 0;
    for (const item of order.items) {
      const variant = item.variantId
        ? await tx.productVariant.updateManyAndReturn({
            where: { id: item.variantId, storeId: actor.storeId },
            data: { stock: { increment: item.quantity } },
            select: { id: true, stock: true },
          })
        : [];
      if (!variant.length) {
        missing += 1;
        continue;
      }
      await tx.stockMovement.create({
        data: {
          storeId: actor.storeId,
          variantId: variant[0].id,
          delta: item.quantity,
          stockAfter: variant[0].stock,
          reason: "CANCEL_RESTOCK",
          orderId: order.id,
          userId: actor.userId,
          note: `Pedido #${order.number} cancelado`,
        },
      });
      if (item.productId) {
        await tx.product.updateMany({
          where: { id: item.productId, storeId: actor.storeId, soldCount: { gte: item.quantity } },
          data: { soldCount: { decrement: item.quantity } },
        });
      }
    }

    if (order.couponCode) {
      await tx.coupon.updateMany({
        where: { storeId: actor.storeId, code: order.couponCode, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }
    if (order.customerId) {
      await tx.customer.updateMany({
        where: { id: order.customerId, storeId: actor.storeId, ordersCount: { gt: 0 }, totalSpent: { gte: order.total } },
        data: { ordersCount: { decrement: 1 }, totalSpent: { decrement: order.total } },
      });
    }

    await tx.order.update({ where: { id: order.id, storeId: actor.storeId }, data: { status: "CANCELLED" } });
    const notes = [
      opts.reason ? `Motivo: ${opts.reason.replace(/[.\s]+$/, "")}.` : null,
      missing ? `${missing} producto(s) ya no existen y no se repusieron.` : "Stock repuesto.",
      order.paymentStatus === "PAID" ? `Pago acreditado de ${formatPrice(order.total)}: el reintegro se gestiona fuera de este panel.` : null,
    ].filter(Boolean);
    await tx.orderEvent.create({
      data: { storeId: actor.storeId, orderId: order.id, userId: actor.userId, type: "cancelled", message: `Pedido cancelado. ${notes.join(" ")}` },
    });
    return { number: order.number, restocked: order.items.length - missing, missing };
  });
}

/** Only for methods the platform cannot verify (transfer, cash, WhatsApp). */
export async function setManualPaymentStatus(actor: Actor, orderId: string, to: PaymentStatus) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, actor, orderId);
    if (order.paymentMethod === "MERCADOPAGO") {
      throw new AdminError("El estado de los pagos con Mercado Pago lo informa Mercado Pago.");
    }
    if (!manualPaymentTargets(order).includes(to)) {
      throw new AdminError(`El pago está ${PAYMENT_LABEL[order.paymentStatus]} y no puede pasar a ${PAYMENT_LABEL[to]}.`);
    }
    const confirm = to === "PAID" && order.status === "NEW";
    await tx.order.update({
      where: { id: order.id, storeId: actor.storeId },
      data: { paymentStatus: to, ...(confirm ? { status: "CONFIRMED" } : {}) },
    });
    await tx.orderEvent.create({
      data: {
        storeId: actor.storeId,
        orderId: order.id,
        userId: actor.userId,
        type: "payment",
        message: `Pago marcado como ${PAYMENT_LABEL[to]} manualmente${confirm ? ". Pedido confirmado." : "."}`,
      },
    });
    return { number: order.number };
  });
}

export async function addOrderNote(actor: Actor, orderId: string, message: string) {
  const order = await db.order.findFirst({ where: { id: orderId, storeId: actor.storeId }, select: { id: true } });
  if (!order) throw new AdminError("No encontramos el pedido.");
  await db.orderEvent.create({ data: { storeId: actor.storeId, orderId: order.id, userId: actor.userId, type: "note", message } });
}
