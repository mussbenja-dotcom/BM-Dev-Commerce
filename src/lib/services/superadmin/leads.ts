import "server-only";
import { db } from "@/lib/db";
import type { LeadStatus, Prisma } from "@/generated/prisma/client";
import { AdminError, PAGE_SIZE } from "@/lib/services/admin/common";

export async function listLeads(f: { status?: LeadStatus; q?: string; page: number }) {
  const q = f.q?.trim();
  const where: Prisma.LeadWhereInput = {
    ...(f.status ? { status: f.status } : { status: { not: "SPAM" } }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { businessName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { whatsapp: { contains: q.replace(/\D/g, "") || q } },
            { instagram: { contains: q.replace(/^@/, ""), mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, rows, counts] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, businessName: true, industry: true, status: true, createdAt: true, whatsapp: true, email: true, needs: true },
    }),
    db.lead.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<LeadStatus, number>>;
  return { total, rows, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), byStatus };
}

export async function getLead(id: string) {
  return db.lead.findUnique({ where: { id }, include: { store: { select: { id: true, name: true, slug: true } } } });
}

export async function updateLead(id: string, input: { status: LeadStatus; notes: string | null }) {
  const r = await db.lead.updateMany({ where: { id }, data: input });
  if (!r.count) throw new AdminError("No encontramos la solicitud.");
}
