import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { requireStoreSession } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/nav";
import { exitSupportAction } from "@/app/superadmin/actions";

export const metadata: Metadata = { title: { default: "Panel — BM Dev Commerce", template: "%s — Panel" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStoreSession();
  const [store, newOrders] = await Promise.all([
    db.store.findUniqueOrThrow({ where: { id: session.storeId }, select: { name: true, slug: true, isDemo: true } }),
    db.order.count({ where: { storeId: session.storeId, status: "NEW" } }),
  ]);

  const storeLink = (
    <Link href={`/s/${store.slug}`} target="_blank" className="flex items-center gap-1.5 text-sm text-muted hover:text-fg">
      Ver tienda <ExternalLink className="size-3.5" aria-hidden />
    </Link>
  );
  const logout = (
    <form action={logoutAction}>
      <button type="submit" className="flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <LogOut className="size-3.5" aria-hidden /> Salir
      </button>
    </form>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-line px-3 py-5 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div className="flex items-center gap-2 px-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-fg text-xs font-bold text-bg">BM</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{store.name}</p>
            <p className="truncate text-xs text-muted">{session.name}</p>
          </div>
        </div>
        <AdminNav newOrders={newOrders} orientation="vertical" />
        <div className="mt-auto flex flex-col gap-3 px-3">
          {storeLink}
          {logout}
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 px-4 pt-3 pb-2 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold">{store.name}</p>
          <div className="flex shrink-0 items-center gap-4">
            {storeLink}
            {logout}
          </div>
        </div>
        <div className="mt-2 -mx-1 overflow-x-auto">
          <AdminNav newOrders={newOrders} orientation="horizontal" />
        </div>
      </header>

      <div className="min-w-0 flex-1">
        {session.supportMode ? (
          <form action={exitSupportAction} className="flex flex-wrap items-center justify-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-900 lg:px-8" role="status">
            <span>Modo soporte BM Dev: los cambios que hagas impactan en esta tienda.</span>
            <button type="submit" className="font-medium underline">Salir del modo soporte</button>
          </form>
        ) : store.isDemo ? (
          <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-[13px] text-amber-900 lg:px-8" role="status">
            Tienda de demostración: podés probar todas las funciones con datos de ejemplo.
          </p>
        ) : null}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
