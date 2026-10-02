"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ReceiptText, Settings, TicketPercent, Users } from "lucide-react";
import { cn } from "@/components/ui/cn";

// Only screens that exist. Add items here as each admin section ships.
const ITEMS = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/admin/pedidos", label: "Pedidos", icon: ReceiptText, exact: false },
  { href: "/admin/productos", label: "Productos", icon: Package, exact: false },
  { href: "/admin/promociones", label: "Promociones", icon: TicketPercent, exact: false },
  { href: "/admin/clientes", label: "Clientes", icon: Users, exact: false },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings, exact: false },
];

export function AdminNav({ newOrders, orientation }: { newOrders: number; orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Panel" className={cn("flex gap-1", orientation === "vertical" ? "flex-col" : "flex-row")}>
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "bg-fg text-bg" : "text-muted hover:bg-bg hover:text-fg",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
            {href === "/admin/pedidos" && newOrders > 0 ? (
              <span
                className={cn(
                  "ml-auto rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-bg/20 text-bg" : "bg-accent text-white",
                )}
                aria-label={`${newOrders} pedidos nuevos`}
              >
                {newOrders}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
