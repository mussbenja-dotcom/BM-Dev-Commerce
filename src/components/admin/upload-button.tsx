"use client";

import { useRef, useState } from "react";
import { ImageUp } from "lucide-react";

/**
 * Uploads one image and writes its URL into the field `target` of the same
 * form (replacing it, or appending a line for lists like product photos).
 */
export function UploadButton({ target, mode = "replace", label = "Subir foto" }: { target: string; mode?: "replace" | "append"; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy: boolean; error?: string; done?: boolean }>({ busy: false });

  async function upload(file: File) {
    setState({ busy: true });
    const body = new FormData();
    body.set("file", file);
    try {
      const res = await fetch("/api/admin/uploads", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) return setState({ busy: false, error: data.error ?? "No pudimos subir la imagen." });
      const field = input.current?.form?.elements.namedItem(target);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.value = mode === "append" && field.value.trim() ? `${field.value.trim()}\n${data.url}` : data.url;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
      setState({ busy: false, done: true });
    } catch {
      setState({ busy: false, error: "No pudimos subir la imagen. Revisá tu conexión." });
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <label className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-theme border border-line px-3 text-sm font-medium hover:border-fg/40 ${state.busy ? "pointer-events-none opacity-60" : ""}`}>
        <ImageUp className="size-4" aria-hidden />
        {state.busy ? "Subiendo…" : label}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      <span className="text-xs text-muted">JPG, PNG o WebP · hasta 4 MB</span>
      {state.error ? <span role="alert" className="w-full text-[13px] text-red-600">{state.error}</span> : null}
      {state.done && !state.error ? <span role="status" className="text-[13px] text-emerald-700">Foto cargada. Guardá para publicarla.</span> : null}
    </span>
  );
}
