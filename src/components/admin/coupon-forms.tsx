"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { saveBannerAction, saveCouponAction, setCouponActiveAction } from "@/app/admin/promociones/actions";
import { AdminForm, Feedback, Submit } from "./form-kit";
import { UploadButton } from "./upload-button";

export type CouponValues = {
  id?: string; code: string; description: string; type: "PERCENT" | "FIXED" | "FREE_SHIPPING"; value: string;
  minSubtotal: string; maxUses: string; startsAt: string; endsAt: string; active: boolean; usedCount: number;
};

export function CouponForm({ coupon }: { coupon: CouponValues }) {
  const isNew = !coupon.id;
  const [type, setType] = useState(coupon.type);
  return (
    <AdminForm action={saveCouponAction} resetOnSuccess={isNew} className="grid gap-4 sm:grid-cols-2" label={isNew ? "Nuevo cupón" : `Editar cupón ${coupon.code}`}>
      {(state, pending) => {
        const e = state?.fieldErrors ?? {};
        return (
          <>
            {coupon.id ? <input type="hidden" name="couponId" value={coupon.id} /> : null}
            <Field label="Código" error={e.code} hint={coupon.usedCount > 0 ? "Ya se usó: el código no se puede cambiar." : "Lo que escribe tu cliente en el carrito."}>
              {(p) => <Input {...p} name="code" required maxLength={30} defaultValue={coupon.code} readOnly={coupon.usedCount > 0} className="uppercase" placeholder="BIENVENIDA10" />}
            </Field>
            <Field label="Tipo de descuento" error={e.type}>
              {(p) => (
                <Select {...p} name="type" value={type} onChange={(ev) => setType(ev.target.value as CouponValues["type"])}>
                  <option value="PERCENT">Porcentaje</option>
                  <option value="FIXED">Monto fijo</option>
                  <option value="FREE_SHIPPING">Envío gratis</option>
                </Select>
              )}
            </Field>
            {type !== "FREE_SHIPPING" ? (
              <Field label={type === "PERCENT" ? "Porcentaje de descuento" : "Monto de descuento"} error={e.value} hint={type === "PERCENT" ? "Entre 1 y 100." : "En pesos."}>
                {(p) => <Input {...p} name="value" inputMode="numeric" required defaultValue={coupon.value} />}
              </Field>
            ) : <input type="hidden" name="value" value="0" />}
            <Field label="Compra mínima (opcional)" error={e.minSubtotal}>
              {(p) => <Input {...p} name="minSubtotal" inputMode="numeric" defaultValue={coupon.minSubtotal} />}
            </Field>
            <Field label="Límite de usos (opcional)" error={e.maxUses} hint={coupon.usedCount ? `Usado ${coupon.usedCount} ${coupon.usedCount === 1 ? "vez" : "veces"}.` : undefined}>
              {(p) => <Input {...p} name="maxUses" inputMode="numeric" defaultValue={coupon.maxUses} />}
            </Field>
            <Field label="Desde (opcional)" error={e.startsAt}>
              {(p) => <Input {...p} name="startsAt" type="date" defaultValue={coupon.startsAt} />}
            </Field>
            <Field label="Hasta (opcional)" error={e.endsAt} hint="Vale hasta las 23:59 de ese día.">
              {(p) => <Input {...p} name="endsAt" type="date" defaultValue={coupon.endsAt} />}
            </Field>
            <Field label="Descripción interna (opcional)" error={e.description} className="sm:col-span-2">
              {(p) => <Input {...p} name="description" maxLength={120} defaultValue={coupon.description} placeholder="Ej.: campaña de Instagram" />}
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={coupon.active} className="size-4 accent-current" /> Activo
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Submit pending={pending} size="sm" pendingLabel="Guardando…">{isNew ? "Crear cupón" : "Guardar cupón"}</Submit>
              <Feedback state={state} />
            </div>
          </>
        );
      }}
    </AdminForm>
  );
}

export function CouponActiveForm({ couponId, active }: { couponId: string; active: boolean }) {
  return (
    <AdminForm action={setCouponActiveAction} className="flex items-center gap-2">
      {(state, pending) => (
        <>
          <input type="hidden" name="couponId" value={couponId} />
          <input type="hidden" name="active" value={String(!active)} />
          <Submit pending={pending} size="sm" variant="secondary" pendingLabel="Guardando…">{active ? "Pausar" : "Activar"}</Submit>
          <Feedback state={state} />
        </>
      )}
    </AdminForm>
  );
}

export type BannerValues = {
  id?: string; placement: "hero" | "promo"; eyebrow: string; title: string; subtitle: string; ctaLabel: string; ctaHref: string;
  imageUrl: string; mobileImageUrl: string; position: string; active: boolean;
};

export function BannerForm({ banner }: { banner: BannerValues }) {
  const isNew = !banner.id;
  return (
    <AdminForm action={saveBannerAction} resetOnSuccess={isNew} className="grid gap-4 sm:grid-cols-2" label={isNew ? "Nuevo banner" : `Editar banner ${banner.title}`}>
      {(state, pending) => {
        const e = state?.fieldErrors ?? {};
        return (
          <>
            {banner.id ? <input type="hidden" name="bannerId" value={banner.id} /> : null}
            <Field label="Ubicación" error={e.placement}>
              {(p) => (
                <Select {...p} name="placement" defaultValue={banner.placement}>
                  <option value="hero">Portada (arriba de todo)</option>
                  <option value="promo">Promoción (bloque del inicio)</option>
                </Select>
              )}
            </Field>
            <Field label="Título" error={e.title}>{(p) => <Input {...p} name="title" maxLength={90} defaultValue={banner.title} />}</Field>
            <Field label="Texto chico arriba (opcional)" error={e.eyebrow}>{(p) => <Input {...p} name="eyebrow" maxLength={60} defaultValue={banner.eyebrow} placeholder="Nueva colección" />}</Field>
            <Field label="Bajada (opcional)" error={e.subtitle}>{(p) => <Input {...p} name="subtitle" maxLength={160} defaultValue={banner.subtitle} />}</Field>
            <Field label="Texto del botón (opcional)" error={e.ctaLabel}>{(p) => <Input {...p} name="ctaLabel" maxLength={30} defaultValue={banner.ctaLabel} placeholder="Ver ofertas" />}</Field>
            <Field label="Link del botón (opcional)" error={e.ctaHref} hint="Una sección de tu tienda, ej. /productos?oferta=1">{(p) => <Input {...p} name="ctaHref" maxLength={200} defaultValue={banner.ctaHref} />}</Field>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Field label="Imagen" error={e.imageUrl}>{(p) => <Input {...p} name="imageUrl" maxLength={500} defaultValue={banner.imageUrl} placeholder="https://res.cloudinary.com/…" />}</Field>
              <UploadButton target="imageUrl" />
            </div>
            <Field label="Imagen para celular (opcional)" error={e.mobileImageUrl} className="sm:col-span-2">{(p) => <Input {...p} name="mobileImageUrl" maxLength={500} defaultValue={banner.mobileImageUrl} />}</Field>
            <Field label="Orden" error={e.position}>{(p) => <Input {...p} name="position" inputMode="numeric" defaultValue={banner.position} />}</Field>
            <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="active" defaultChecked={banner.active} className="size-4 accent-current" /> Visible</label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Submit pending={pending} size="sm" pendingLabel="Guardando…">{isNew ? "Crear banner" : "Guardar banner"}</Submit>
              <Feedback state={state} />
            </div>
          </>
        );
      }}
    </AdminForm>
  );
}
