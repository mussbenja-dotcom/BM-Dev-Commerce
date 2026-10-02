"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { submitLeadAction } from "@/app/tienda-online/actions";
import { HONEYPOT_FIELD, LEAD_INDUSTRIES, NEEDS, PRODUCT_COUNTS, SELLS_ONLINE, type LeadField, type LeadFormState } from "@/lib/services/leads/form";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

const initial: LeadFormState = { status: "idle" };

function YesNo({ name, legend, value }: { name: LeadField; legend: string; value?: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-fg">{legend} <span className="font-normal text-muted">(opcional)</span></legend>
      <div className="flex gap-2">
        {[["si", "Sí"], ["no", "No"]].map(([v, label]) => (
          <label key={v} className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-theme border border-line text-sm has-[:checked]:border-fg has-[:checked]:bg-surface">
            <input type="radio" name={name} value={v} defaultChecked={value === v} className="accent-current" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function LeadForm({ fallbackWhatsappUrl }: { fallbackWhatsappUrl: string | null }) {
  const [state, formAction, pending] = useActionState(submitLeadAction, initial);
  const successRef = useRef<HTMLDivElement>(null);
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const values = state.status === "error" ? state.values ?? {} : {};

  useEffect(() => {
    if (state.status === "success") successRef.current?.focus();
  }, [state.status]);

  // Submitting through a transition (instead of the form action) keeps what the
  // visitor typed when the server returns errors. Without JS the native POST still works.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  if (state.status === "success") {
    const whatsapp = state.whatsappUrl ?? fallbackWhatsappUrl;
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-bg p-6 outline-none sm:p-8">
        <CheckCircle2 className="text-emerald-600" size={36} aria-hidden />
        <h3 className="text-2xl font-semibold tracking-tight">¡Gracias! Recibimos tu solicitud.</h3>
        <p className="text-muted">Te vamos a contactar a la brevedad para conocer tu negocio y armarte un presupuesto a medida.</p>
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClasses("whatsapp", "lg")}>
            <MessageCircle size={18} aria-hidden /> Adelantar la charla por WhatsApp
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="relative grid gap-4 rounded-2xl border border-line bg-bg p-5 sm:grid-cols-2 sm:p-8" aria-label="Solicitar mi tienda online">
      {state.status === "error" && state.message ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{state.message}</p>
      ) : null}
      <Field label="Nombre" error={errors.name}>
        {(p) => <Input {...p} name="name" autoComplete="name" required maxLength={80} defaultValue={values.name} />}
      </Field>
      <Field label="Nombre del negocio" error={errors.businessName}>
        {(p) => <Input {...p} name="businessName" autoComplete="organization" required maxLength={100} defaultValue={values.businessName} />}
      </Field>
      <Field label="WhatsApp" error={errors.whatsapp} hint={errors.whatsapp ? undefined : "Con código de área, ej. 11 2345 6789"}>
        {(p) => <Input {...p} name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" required maxLength={30} defaultValue={values.whatsapp} />}
      </Field>
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required maxLength={120} defaultValue={values.email} />}
      </Field>
      <Field label="Instagram (opcional)" error={errors.instagram}>
        {(p) => <Input {...p} name="instagram" placeholder="@tunegocio" maxLength={120} defaultValue={values.instagram} />}
      </Field>
      <Field label="Rubro" error={errors.industry}>
        {(p) => (
          <Select {...p} name="industry" required defaultValue={values.industry ?? ""}>
            <option value="" disabled>Elegí un rubro</option>
            {LEAD_INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </Select>
        )}
      </Field>
      <Field label="¿Actualmente vendés online?" error={errors.sellsOnline}>
        {(p) => (
          <Select {...p} name="sellsOnline" required defaultValue={values.sellsOnline ?? ""}>
            <option value="" disabled>Elegí una opción</option>
            {Object.entries(SELLS_ONLINE).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Cantidad aproximada de productos" error={errors.productCount}>
        {(p) => (
          <Select {...p} name="productCount" required defaultValue={values.productCount ?? ""}>
            <option value="" disabled>Elegí una cantidad</option>
            {Object.entries(PRODUCT_COUNTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        )}
      </Field>
      <Field label="¿Qué necesitás?" error={errors.needs} className="sm:col-span-2">
        {(p) => (
          <Select {...p} name="needs" required defaultValue={values.needs ?? ""}>
            <option value="" disabled>Elegí lo que más se acerque</option>
            {Object.entries(NEEDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        )}
      </Field>
      <YesNo name="hasDomain" legend="¿Ya tenés dominio?" value={values.hasDomain} />
      <YesNo name="usesMercadoPago" legend="¿Usás Mercado Pago?" value={values.usesMercadoPago} />
      <Field label="Comentario adicional (opcional)" error={errors.comment} className="sm:col-span-2">
        {(p) => <Textarea {...p} name="comment" maxLength={1000} rows={3} placeholder="Contanos tu idea, qué vendés o qué te gustaría que tenga tu tienda." defaultValue={values.comment} />}
      </Field>
      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Sitio web<input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "Enviando…" : "Quiero mi tienda online"}
        </Button>
        <p className="text-center text-xs text-muted">Sin compromiso. Te respondemos con un presupuesto según lo que necesites.</p>
      </div>
    </form>
  );
}
