"use client";
import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "@/components/ui/button";

// The form renders in one place at a time (sidebar or mobile modal) so ids and labels stay unique.
export function CatalogFilters({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <><aside className="hidden w-56 shrink-0 lg:block">{!open && children}</aside><div className="mb-5 lg:hidden"><Button variant="secondary" onClick={() => setOpen(true)}><SlidersHorizontal size={16} /> Filtrar y ordenar</Button><Modal open={open} onClose={() => setOpen(false)} title="Filtros" drawer>{children}</Modal></div></>;
}
