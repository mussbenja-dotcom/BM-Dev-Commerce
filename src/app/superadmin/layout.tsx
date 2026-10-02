import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { requireSuperadmin } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { db } from "@/lib/db";
import { SuperadminNav } from "@/components/superadmin/nav";
import { exitSupportAction } from "./actions";

export const metadata: Metadata = { title: { default: "BM Dev — Panel interno", template: "%s — BM Dev" }, robots: { index: false } };

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperadmin();
  const [newLeads, supportStore] = await Promise.all([
    db.lead.count({ where: { status: "NEW" } }),
    session.supportMode && session.storeId ? db.store.findUnique({ where: { id: session.storeId }, select: { name: true } }) : null,
  ]);
  const logout = (
    <form action={logoutAction}>
      <button type="submit" className="flex items-center gap-1.5 text-sm text-muted hover:text-fg"><LogOut className="size-3.5" aria-hidden /> Salir</button>
    </form>
  );
  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-line px-3 py-5 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div className="flex items-center gap-2 px-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-xs font-bold text-white">BM</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">BM Dev · interno</p>
            <p className="truncate text-xs text-muted">{session.email}</p>
          </div>
        </div>
        <SuperadminNav newLeads={newLeads} orientation="vertical" />
        <div className="mt-auto px-3">{logout}</div>
      </aside>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 px-4 pt-3 pb-2 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold">BM Dev · interno</p>
          {logout}
        </div>
        <div className="mt-2 -mx-1 overflow-x-auto"><SuperadminNav newLeads={newLeads} orientation="horizontal" /></div>
      </header>
      <div className="min-w-0 flex-1">
        {supportStore ? (
          <form action={exitSupportAction} className="flex flex-wrap items-center justify-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-900">
            <span>Tu sesión sigue en modo soporte de <strong>{supportStore.name}</strong>.</span>
            <button type="submit" className="font-medium underline">Salir del modo soporte</button>
          </form>
        ) : null}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
