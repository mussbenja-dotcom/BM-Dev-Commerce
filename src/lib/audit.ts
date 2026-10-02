import "server-only";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/request";

export async function audit(entry: {
  action: string;
  storeId?: string | null;
  userId?: string | null;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        storeId: entry.storeId ?? null,
        userId: entry.userId ?? null,
        entity: entry.entity,
        entityId: entry.entityId,
        meta: entry.meta as object | undefined,
        ip: await clientIp(),
      },
    });
  } catch (err) {
    // Audit must never break the user action, but it must be visible in logs.
    console.error("[audit] failed to write", entry.action, err);
  }
}
