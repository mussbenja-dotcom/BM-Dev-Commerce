"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, drawer = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, [open]);
  return <dialog ref={ref} aria-label={title} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className={`fixed max-h-dvh bg-bg text-fg backdrop:bg-black/40 ${drawer ? "inset-y-0 left-auto right-0 m-0 h-dvh w-full max-w-lg animate-drawer-right" : "inset-0 m-auto w-[calc(100%-2rem)] max-w-4xl rounded-theme"}`}>
    <div className="flex items-center justify-between border-b border-line p-5"><h2 className="font-heading text-xl">{title}</h2><button type="button" onClick={onClose} aria-label={`Cerrar ${title.toLowerCase()}`} className="p-2"><X size={22} /></button></div>
    <div className="p-5">{open && children}</div>
  </dialog>;
}
