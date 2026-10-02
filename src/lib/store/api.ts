import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Resolves an ACTIVE store id for public API routes. */
export async function activeStoreId(slug: string): Promise<string | null> {
  const store = await db.store.findUnique({ where: { slug }, select: { id: true, status: true } });
  return store && store.status === "ACTIVE" ? store.id : null;
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}
