"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutDashboard, Store } from "lucide-react";
import { cn } from "@/components/ui/cn";

const ITEMS = [
  { href: "/superadmin", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/superadmin/solicitudes", label: "Solicitudes", icon: Inbox, exact: false },
  { href: "/superadmin/tiendas", label: "Tiendas", icon: Store, exact: false },
];

export function SuperadminNav({ newLeads, orientation }: { newLeads: number; orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Panel BM Dev" className={cn("flex gap-1", orientation === "vertical" ? "flex-col" : "flex-row")}>
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn("flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors", active ? "bg-fg text-bg" : "text-muted hover:bg-bg hover:text-fg")}>
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
            {href === "/superadmin/solicitudes" && newLeads > 0 ? (
              <span className={cn("ml-auto rounded-full px-1.5 text-xs tabular-nums", active ? "bg-bg/20 text-bg" : "bg-accent text-white")} aria-label={`${newLeads} solicitudes nuevas`}>{newLeads}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
