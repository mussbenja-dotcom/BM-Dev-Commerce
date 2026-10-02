"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { AdminForm, Feedback, Submit } from "@/components/admin/form-kit";
import type { ActionState } from "@/lib/services/admin/types";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, suggestSlug } from "@/lib/services/superadmin/rules";
import {
  addDomainAction, addStoreUserAction, createStoreAction, domainAction, storeUserAction, updateLeadAction, updateStoreAction,
} from "@/app/superadmin/actions";

/** Temporary credentials are only in this response: they are stored hashed. */
function Credentials({ state }: { state: ActionState }) {
  if (!state?.ok || !state.credentials) return null;
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
      <p className="flex items-center gap-1.5 font-medium"><KeyRound className="size-4" aria-hidden /> Datos de acceso (se muestran una sola vez)</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt>Email</dt><dd className="break-all font-mono">{state.credentials.email}</dd>
        <dt>Contraseña</dt><dd className="font-mono" data-testid="temp-password">{state.credentials.password}</dd>
      </dl>
      <p className="mt-2 text-xs">Enviáselos al comercio por un canal privado. Puede ingresar en /login.</p>
    </div>
  );
}

export function LeadStatusForm({ leadId, status, notes }: { leadId: string; status: string; notes: string }) {
  return (
    <AdminForm action={updateLeadAction} label="Seguimiento de la solicitud" className="flex flex-col gap-3">
      {(state, pending) => (
        <>
          <input type="hidden" name="leadId" value={leadId} />
          <Field label="Estado" error={state?.fieldErrors?.status}>
            {(p) => (
              <Select {...p} name="status" defaultValue={status}>
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Notas internas" error={state?.fieldErrors?.notes}>
            {(p) => <Textarea {...p} name="notes" rows={4} maxLength={2000} defaultValue={notes} placeholder="Ej.: le pasamos presupuesto el martes" />}
          </Field>
          <div className="flex items-center gap-3">
            <Submit pending={pending} size="sm" pendingLabel="Guardando…">Guardar</Submit>
            <Feedback state={state} />
          </div>
        </>
      )}
    </AdminForm>
  );
}

export type NewStoreValues = { leadId?: string; name: string; ownerName: string; ownerEmail: string; whatsapp: string; industry: string };

export function NewStoreForm({ values, templates, industries }: { values: NewStoreValues; templates: { key: string; label: string }[]; industries: readonly string[] }) {
  const [slug, setSlug] = useState(suggestSlug(values.name));
  const [touched, setTouched] = useState(false);
  return (
    <AdminForm action={createStoreAction} label="Nueva tienda" className="flex flex-col gap-5">
      {(state, pending) => {
        const e = state?.fieldErrors ?? {};
        if (state?.ok && state.id) {
          return (
            <div className="flex flex-col gap-4">
              <Feedback state={state} />
              <Credentials state={state} />
              <a href={`/superadmin/tiendas/${state.id}`} className="text-sm font-medium underline">Ir a la tienda</a>
            </div>
          );
        }
        return (
          <>
            {values.leadId ? <input type="hidden" name="leadId" value={values.leadId} /> : null}
            <section className="grid gap-4 rounded-xl border border-line bg-bg p-4 sm:grid-cols-2 sm:p-5">
              <h2 className="text-sm font-semibold sm:col-span-2">Negocio</h2>
              <Field label="Nombre de la tienda" error={e.name}>
                {(p) => <Input {...p} name="name" maxLength={60} defaultValue={values.name} onChange={(ev) => { if (!touched) setSlug(suggestSlug(ev.target.value)); }} />}
              </Field>
              <Field label="Dirección (slug)" error={e.slug} hint={`Queda en /s/${slug || "…"}`}>
                {(p) => <Input {...p} name="slug" maxLength={40} value={slug} onChange={(ev) => { setTouched(true); setSlug(ev.target.value.toLowerCase()); }} />}
              </Field>
              <Field label="Rubro" error={e.industry}>
                {(p) => (
                  <Select {...p} name="industry" defaultValue={industries.includes(values.industry) ? values.industry : "Otro"}>
                    {industries.map((i) => <option key={i} value={i}>{i}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Plantilla" error={e.template}>
                {(p) => (
                  <Select {...p} name="template" defaultValue={templates[0]?.key}>
                    {templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Plan" error={e.plan}>
                {(p) => (
                  <Select {...p} name="plan" defaultValue="ESENCIAL">
                    <option value="ESENCIAL">Esencial</option>
                    <option value="PROFESIONAL">Profesional</option>
                    <option value="A_MEDIDA">A medida</option>
                  </Select>
                )}
              </Field>
              <Field label="Dominio propio (opcional)" error={e.domain} hint="Se puede agregar después.">
                {(p) => <Input {...p} name="domain" maxLength={120} placeholder="mitienda.com.ar" />}
              </Field>
            </section>
            <section className="grid gap-4 rounded-xl border border-line bg-bg p-4 sm:grid-cols-2 sm:p-5">
              <h2 className="text-sm font-semibold sm:col-span-2">Dueño o dueña</h2>
              <Field label="Nombre" error={e.ownerName}>
                {(p) => <Input {...p} name="ownerName" maxLength={80} defaultValue={values.ownerName} />}
              </Field>
              <Field label="Email (para ingresar)" error={e.ownerEmail}>
                {(p) => <Input {...p} name="ownerEmail" type="email" maxLength={120} defaultValue={values.ownerEmail} />}
              </Field>
              <Field label="WhatsApp de la tienda (opcional)" error={e.whatsapp}>
                {(p) => <Input {...p} name="whatsapp" maxLength={30} defaultValue={values.whatsapp} />}
              </Field>
            </section>
            <p className="text-sm text-muted">La tienda se crea en <strong>borrador</strong> con categorías, envíos y un cupón de ejemplo según la plantilla. Se publica al pasarla a “Activa”.</p>
            <div className="flex items-center gap-3">
              <Submit pending={pending} pendingLabel="Creando…">Crear tienda</Submit>
              <Feedback state={state} />
            </div>
          </>
        );
      }}
    </AdminForm>
  );
}

export function StoreSettingsForm({ store }: { store: { id: string; name: string; status: string; plan: string; notes: string } }) {
  return (
    <AdminForm action={updateStoreAction} label="Estado de la tienda" className="grid gap-4 sm:grid-cols-3">
      {(state, pending) => {
        const e = state?.fieldErrors ?? {};
        return (
          <>
            <input type="hidden" name="storeId" value={store.id} />
            <Field label="Nombre" error={e.name}>{(p) => <Input {...p} name="name" maxLength={60} defaultValue={store.name} />}</Field>
            <Field label="Estado" error={e.status} hint="Suspendida: el comercio no puede ingresar y la tienda no se muestra.">
              {(p) => (
                <Select {...p} name="status" defaultValue={store.status}>
                  <option value="DRAFT">Borrador</option>
                  <option value="ACTIVE">Activa</option>
                  <option value="SUSPENDED">Suspendida</option>
                </Select>
              )}
            </Field>
            <Field label="Plan" error={e.plan}>
              {(p) => (
                <Select {...p} name="plan" defaultValue={store.plan}>
                  <option value="ESENCIAL">Esencial</option>
                  <option value="PROFESIONAL">Profesional</option>
                  <option value="A_MEDIDA">A medida</option>
                </Select>
              )}
            </Field>
            <Field label="Notas internas" error={e.notes} className="sm:col-span-3">
              {(p) => <Textarea {...p} name="notes" rows={3} maxLength={2000} defaultValue={store.notes} />}
            </Field>
            <div className="flex items-center gap-3 sm:col-span-3">
              <Submit pending={pending} size="sm" pendingLabel="Guardando…">Guardar</Submit>
              <Feedback state={state} />
            </div>
          </>
        );
      }}
    </AdminForm>
  );
}

export function AddDomainForm({ storeId }: { storeId: string }) {
  return (
    <AdminForm action={addDomainAction} resetOnSuccess label="Agregar dominio" className="flex flex-col gap-2">
      {(state, pending) => (
        <>
          <input type="hidden" name="storeId" value={storeId} />
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Dominio" error={state?.fieldErrors?.hostname} className="min-w-48 flex-1">
              {(p) => <Input {...p} name="hostname" maxLength={200} placeholder="mitienda.com.ar" className="h-10" />}
            </Field>
            <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="primary" className="size-4 accent-current" /> Principal</label>
            <Submit pending={pending} size="sm" className="h-10" pendingLabel="Agregando…">Agregar</Submit>
          </div>
          <Feedback state={state} />
        </>
      )}
    </AdminForm>
  );
}

export function DomainActions({ storeId, domain }: { storeId: string; domain: { id: string; hostname: string; isPrimary: boolean; verified: boolean } }) {
  return (
    <AdminForm action={domainAction} label={`Acciones de ${domain.hostname}`} className="flex flex-col items-end gap-1">
      {(state, pending) => (
        <>
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="domainId" value={domain.id} />
          <div className="flex flex-wrap justify-end gap-1.5">
            {!domain.isPrimary ? <Submit pending={pending} name="op" value="primary" size="sm" variant="ghost" pendingLabel="…">Hacer principal</Submit> : null}
            <Submit pending={pending} name="op" value={domain.verified ? "unverify" : "verify"} size="sm" variant="ghost" pendingLabel="…">{domain.verified ? "Marcar sin verificar" : "Marcar verificado"}</Submit>
            <Submit pending={pending} name="op" value="remove" size="sm" variant="ghost" className="text-red-700" pendingLabel="…">Quitar</Submit>
          </div>
          <Feedback state={state} />
        </>
      )}
    </AdminForm>
  );
}

export function AddUserForm({ storeId }: { storeId: string }) {
  return (
    <AdminForm action={addStoreUserAction} resetOnSuccess label="Agregar usuario" className="flex flex-col gap-3">
      {(state, pending) => (
        <>
          <input type="hidden" name="storeId" value={storeId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" error={state?.fieldErrors?.name}>{(p) => <Input {...p} name="name" maxLength={80} />}</Field>
            <Field label="Email" error={state?.fieldErrors?.email}>{(p) => <Input {...p} name="email" type="email" maxLength={120} />}</Field>
          </div>
          <div className="flex items-center gap-3">
            <Submit pending={pending} size="sm" variant="secondary" pendingLabel="Creando…">Crear usuario</Submit>
            {!state?.credentials ? <Feedback state={state} /> : null}
          </div>
          <Credentials state={state} />
        </>
      )}
    </AdminForm>
  );
}

export function UserActions({ storeId, user }: { storeId: string; user: { id: string; email: string; active: boolean } }) {
  return (
    <AdminForm action={storeUserAction} label={`Acciones de ${user.email}`} className="flex flex-col items-end gap-2">
      {(state, pending) => (
        <>
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="userId" value={user.id} />
          <div className="flex flex-wrap justify-end gap-1.5">
            <Submit pending={pending} name="op" value="reset" size="sm" variant="ghost" pendingLabel="…">Nueva contraseña</Submit>
            <Submit pending={pending} name="op" value={user.active ? "deactivate" : "activate"} size="sm" variant="ghost" className={user.active ? "text-red-700" : undefined} pendingLabel="…">
              {user.active ? "Desactivar" : "Reactivar"}
            </Submit>
          </div>
          {state?.credentials ? <Credentials state={state} /> : <Feedback state={state} />}
        </>
      )}
    </AdminForm>
  );
}
