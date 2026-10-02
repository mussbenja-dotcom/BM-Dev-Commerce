"use client";
import { useState } from "react";
import { useHref, useStore } from "./store-context";
import { Button } from "@/components/ui/button";

export function PaymentControls({ token, demo = false }: { token: string; demo?: boolean }) {
  const store = useStore(); const href = useHref();
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function submit(status?: string) {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/store/${store.slug}/orders/${token}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(demo ? { intent: "demo", status } : { intent: "retry" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No pudimos procesar el pago.");
      const prefix = `/s/${store.slug}`;
      const url = String(result.url);
      window.location.assign(url.startsWith(prefix) ? href(url.slice(prefix.length)) : url);
    } catch (err) { setError(err instanceof Error ? err.message : "Error de conexión."); setPending(false); }
  }
  return <div className="space-y-3">{demo ? <><Button disabled={pending} className="w-full" onClick={() => submit("PAID")}>Simular pago aprobado</Button><Button disabled={pending} className="w-full" variant="secondary" onClick={() => submit("PENDING")}>Simular pago pendiente</Button><Button disabled={pending} className="w-full" variant="secondary" onClick={() => submit("FAILED")}>Simular pago rechazado</Button></> : <Button disabled={pending} onClick={() => submit()}>{pending ? "Iniciando pago…" : "Pagar con Mercado Pago"}</Button>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}
