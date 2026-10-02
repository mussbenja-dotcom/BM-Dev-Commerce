"use client";

import { useState, type ReactNode } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  saveContactAction, saveFreeShippingAction, savePaymentsAction, savePoliciesAction, saveShippingMethodAction, saveStoreInfoAction, saveThemeAction,
} from "@/app/admin/configuracion/actions";
import { AdminForm, Feedback, Submit, type AdminAction } from "./form-kit";
import { UploadButton } from "./upload-button";
import { HEX_COLOR, readableOn } from "@/lib/color";

type Values = Record<string, string>;

function SectionForm({ action, label, submit, children, className = "grid gap-4 sm:grid-cols-2" }: {
  action: AdminAction; label: string; submit: string; className?: string;
  children: (errors: Record<string, string>) => ReactNode;
}) {
  return (
    <AdminForm action={action} label={label} className="flex flex-col gap-4">
      {(state, pending) => (
        <>
          <div className={className}>{children(state?.fieldErrors ?? {})}</div>
          <div className="flex items-center gap-3">
            <Submit pending={pending} size="sm" pendingLabel="Guardando…">{submit}</Submit>
            <Feedback state={state} />
          </div>
        </>
      )}
    </AdminForm>
  );
}

function Text({ name, label, values, errors, hint, max, className, type, placeholder }: {
  name: string; label: string; values: Values; errors: Record<string, string>; hint?: string; max: number; className?: string; type?: string; placeholder?: string;
}) {
  return (
    <Field label={label} error={errors[name]} hint={hint} className={className}>
      {(p) => <Input {...p} name={name} type={type} maxLength={max} defaultValue={values[name] ?? ""} placeholder={placeholder} />}
    </Field>
  );
}

function Toggle({ name, label, hint, defaultChecked, error }: { name: string; label: string; hint?: string; defaultChecked: boolean; error?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-current" aria-invalid={!!error} />
      <span>
        {label}
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
        {error ? <span className="block text-[13px] text-red-600" role="alert">{error}</span> : null}
      </span>
    </label>
  );
}

export function StoreInfoForm({ values }: { values: Values }) {
  return (
    <SectionForm action={saveStoreInfoAction} label="Datos de la tienda" submit="Guardar datos">
      {(e) => (
        <>
          <Text name="name" label="Nombre de la tienda" values={values} errors={e} max={80} />
          <Text name="tagline" label="Frase corta (opcional)" values={values} errors={e} max={120} hint="Aparece debajo del nombre." />
          <Field label="Descripción (opcional)" error={e.description} className="sm:col-span-2">
            {(p) => <Textarea {...p} name="description" maxLength={1000} rows={3} defaultValue={values.description ?? ""} />}
          </Field>
          <Text name="announcement" label="Barra de anuncio (opcional)" values={values} errors={e} max={140} placeholder="Envío gratis desde $ 50.000" className="sm:col-span-2" />
          <div className="flex flex-col gap-1.5">
            <Text name="logoUrl" label="Logo (opcional)" values={values} errors={e} max={500} placeholder="https://…" />
            <UploadButton target="logoUrl" label="Subir logo" />
          </div>
          <Text name="faviconUrl" label="Ícono de pestaña (URL, opcional)" values={values} errors={e} max={500} placeholder="https://…" />
          <Text name="footerText" label="Texto del pie (opcional)" values={values} errors={e} max={300} className="sm:col-span-2" />
          <Text name="seoTitle" label="Título para buscadores (opcional)" values={values} errors={e} max={70} />
          <Text name="seoDescription" label="Descripción para buscadores (opcional)" values={values} errors={e} max={160} />
        </>
      )}
    </SectionForm>
  );
}

export function ContactForm({ values, provinces }: { values: Values; provinces: readonly string[] }) {
  return (
    <SectionForm action={saveContactAction} label="Contacto" submit="Guardar contacto">
      {(e) => (
        <>
          <Text name="whatsapp" label="WhatsApp de la tienda" values={values} errors={e} max={30} type="tel" hint="Con código de país y área, ej. 54 9 11 2345 6789. Recibe consultas y pedidos." />
          <Text name="email" label="Email" values={values} errors={e} max={120} type="email" />
          <Text name="phone" label="Teléfono (opcional)" values={values} errors={e} max={30} type="tel" />
          <Text name="hours" label="Horarios (opcional)" values={values} errors={e} max={160} placeholder="Lun a vie de 10 a 18" />
          <Text name="instagram" label="Instagram (opcional)" values={values} errors={e} max={60} placeholder="@tutienda" />
          <Text name="facebook" label="Facebook (opcional)" values={values} errors={e} max={60} />
          <Text name="tiktok" label="TikTok (opcional)" values={values} errors={e} max={60} />
          <Text name="address" label="Dirección (opcional)" values={values} errors={e} max={160} />
          <Text name="city" label="Ciudad (opcional)" values={values} errors={e} max={80} />
          <Field label="Provincia (opcional)" error={e.province}>
            {(p) => (
              <Select {...p} name="province" defaultValue={values.province ?? ""}>
                <option value="">Sin especificar</option>
                {provinces.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
              </Select>
            )}
          </Field>
        </>
      )}
    </SectionForm>
  );
}

export function PaymentsForm({ values, flags, mercadoPago, bankLocked = false }: {
  bankLocked?: boolean;
  values: Values;
  flags: { enableMercadoPago: boolean; enableTransfer: boolean; enableCash: boolean; enableWhatsappOrder: boolean };
  mercadoPago: { available: boolean; demo: boolean };
}) {
  const mpHint = mercadoPago.demo ? "Tienda demo: los pagos son simulados." : mercadoPago.available ? "Conectado por BM Dev." : "Todavía no está conectado: BM Dev lo configura con tu cuenta. Mientras tanto no se muestra en el checkout.";
  return (
    <SectionForm action={savePaymentsAction} label="Medios de pago" submit="Guardar medios de pago">
      {(e) => (
        <>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <Toggle name="enableMercadoPago" label="Mercado Pago" hint={mpHint} defaultChecked={flags.enableMercadoPago} />
            <Toggle name="enableTransfer" label="Transferencia bancaria" defaultChecked={flags.enableTransfer} error={e.enableTransfer} />
            <Toggle name="enableCash" label="Efectivo al retirar" defaultChecked={flags.enableCash} />
            <Toggle name="enableWhatsappOrder" label="Pedido por WhatsApp" hint="El cliente te envía el pedido armado y coordinan el pago." defaultChecked={flags.enableWhatsappOrder} />
          </div>
          <Text name="transferDiscountPct" label="Descuento por transferencia (%)" values={values} errors={e} max={2} />
          <Text name="maxInstallments" label="Cuotas que mostrás" values={values} errors={e} max={2} hint="Solo informativo en la ficha del producto." />
          <h3 className="pt-2 text-sm font-semibold sm:col-span-2">Datos para transferencias</h3>
          {bankLocked ? <p className="-mt-2 text-xs text-amber-800 sm:col-span-2">Modo demo: los datos bancarios son de ejemplo y no se pueden cambiar.</p> : null}
          <fieldset disabled={bankLocked} className="contents">
            <Text name="bankHolder" label="Titular" values={values} errors={e} max={80} />
            <Text name="bankName" label="Banco o billetera (opcional)" values={values} errors={e} max={60} />
            <Text name="bankAlias" label="Alias" values={values} errors={e} max={20} />
            <Text name="bankCbu" label="CBU / CVU" values={values} errors={e} max={30} />
            <Text name="bankCuit" label="CUIT (opcional)" values={values} errors={e} max={20} />
          </fieldset>
        </>
      )}
    </SectionForm>
  );
}

export function FreeShippingForm({ value }: { value: string }) {
  return (
    <SectionForm action={saveFreeShippingAction} label="Envío gratis" submit="Guardar" className="grid gap-4">
      {(e) => (
        <Field label="Envío gratis desde (opcional)" error={e._ ?? e.freeShippingThreshold} hint="Vacío = sin envío gratis por monto. Los cupones de envío gratis siguen funcionando.">
          {(p) => <Input {...p} name="freeShippingThreshold" inputMode="numeric" defaultValue={value} className="sm:max-w-60" />}
        </Field>
      )}
    </SectionForm>
  );
}

export type ShippingValues = { id?: string; name: string; description: string; type: "SHIPPING" | "PICKUP"; price: string; provinces: string[]; estimatedDays: string; active: boolean; position: string };

export function ShippingMethodForm({ method, provinces }: { method: ShippingValues; provinces: readonly string[] }) {
  const isNew = !method.id;
  const [type, setType] = useState(method.type);
  return (
    <AdminForm action={saveShippingMethodAction} resetOnSuccess={isNew} label={isNew ? "Nueva forma de entrega" : `Editar ${method.name}`} className="flex flex-col gap-4">
      {(state, pending) => {
        const e = state?.fieldErrors ?? {};
        return (
          <>
            {method.id ? <input type="hidden" name="methodId" value={method.id} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" error={e.name}>
                {(p) => <Input {...p} name="name" maxLength={60} defaultValue={method.name} placeholder="Envío a domicilio" />}
              </Field>
              <Field label="Tipo" error={e.type}>
                {(p) => (
                  <Select {...p} name="type" value={type} onChange={(ev) => setType(ev.target.value as ShippingValues["type"])}>
                    <option value="SHIPPING">Envío</option>
                    <option value="PICKUP">Retiro en el local</option>
                  </Select>
                )}
              </Field>
              <Field label="Costo" error={e.price} hint="0 si es gratis.">
                {(p) => <Input {...p} name="price" inputMode="numeric" defaultValue={method.price} />}
              </Field>
              <Field label="Demora (opcional)" error={e.estimatedDays}>
                {(p) => <Input {...p} name="estimatedDays" maxLength={60} defaultValue={method.estimatedDays} placeholder="2 a 4 días hábiles" />}
              </Field>
              <Field label="Detalle (opcional)" error={e.description} className="sm:col-span-2">
                {(p) => <Input {...p} name="description" maxLength={200} defaultValue={method.description} />}
              </Field>
            </div>
            {type === "SHIPPING" ? (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Provincias <span className="font-normal text-muted">(ninguna marcada = todo el país)</span></legend>
                {e.provinces ? <p className="mb-2 text-[13px] text-red-600" role="alert">{e.provinces}</p> : null}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                  {provinces.map((pr) => (
                    <label key={pr} className="flex items-center gap-2">
                      <input type="checkbox" name="provinces" value={pr} defaultChecked={method.provinces.includes(pr)} className="size-4 accent-current" />{pr}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={method.active} className="size-4 accent-current" /> Disponible</label>
              <label className="flex items-center gap-2 text-sm">Orden <span className="w-16"><Input name="position" inputMode="numeric" defaultValue={method.position} className="h-9" /></span></label>
            </div>
            <div className="flex items-center gap-3">
              <Submit pending={pending} size="sm" pendingLabel="Guardando…">{isNew ? "Crear forma de entrega" : "Guardar"}</Submit>
              <Feedback state={state} />
            </div>
          </>
        );
      }}
    </AdminForm>
  );
}

export function PoliciesForm({ values }: { values: Values }) {
  const items = [["shippingPolicy", "Envíos"], ["returnsPolicy", "Cambios y devoluciones"], ["privacyPolicy", "Privacidad"], ["termsPolicy", "Términos y condiciones"]] as const;
  return (
    <SectionForm action={savePoliciesAction} label="Políticas" submit="Guardar políticas" className="grid gap-4">
      {(e) => items.map(([name, label]) => (
        <Field key={name} label={label} error={e[name]} hint="Se publica en el pie de tu tienda.">
          {(p) => <Textarea {...p} name={name} rows={4} maxLength={name === "termsPolicy" ? 10000 : 5000} defaultValue={values[name] ?? ""} />}
        </Field>
      ))}
    </SectionForm>
  );
}

const SECTION_LABEL: Record<string, string> = {
  hero: "Portada", categories: "Categorías", featured: "Destacados", new: "Novedades", promo: "Banners de promoción",
  offers: "Ofertas", bestsellers: "Más vendidos", benefits: "Beneficios (envío, cuotas, cambios)", instagram: "Instagram",
};

export type ThemeValues = {
  template: string; primaryColor: string; accentColor: string; backgroundColor: string; textColor: string;
  headingFont: string; bodyFont: string; radius: string; heroLayout: string; cardStyle: string; headingCase: string; homeSections: string[];
};

export function ThemeForm({ values, templates, fonts, sections, storeUrl }: {
  values: ThemeValues; templates: { key: string; label: string; description: string }[]; fonts: Record<string, string>; sections: readonly string[]; storeUrl: string;
}) {
  const [colors, setColors] = useState({ primaryColor: values.primaryColor, accentColor: values.accentColor, backgroundColor: values.backgroundColor, textColor: values.textColor });
  const ordered = [...values.homeSections, ...sections.filter((s) => !values.homeSections.includes(s))];
  const color = (name: keyof typeof colors, label: string, e: Record<string, string>) => (
    <Field label={label} error={e[name]}>
      {(p) => (
        <span className="flex items-center gap-2">
          <input type="color" aria-label={`${label} (selector)`} value={colors[name]} onChange={(ev) => setColors({ ...colors, [name]: ev.target.value })} className="h-11 w-12 shrink-0 cursor-pointer rounded-theme border border-line bg-bg p-1" />
          <Input {...p} name={name} value={colors[name]} maxLength={7} onChange={(ev) => setColors({ ...colors, [name]: ev.target.value })} className="font-mono" />
        </span>
      )}
    </Field>
  );
  return (
    <AdminForm action={saveThemeAction} label="Apariencia" className="flex flex-col gap-5">
      {(state, pending) => {
        const e = state?.fieldErrors ?? {};
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Plantilla" error={e.template}>
                {(p) => (
                  <Select {...p} name="template" defaultValue={values.template}>
                    {templates.map((t) => <option key={t.key} value={t.key}>{t.label} — {t.description}</option>)}
                  </Select>
                )}
              </Field>
              <label className="flex items-start gap-2.5 self-end pb-2 text-sm">
                <input type="checkbox" name="applyTemplate" className="mt-0.5 size-4 accent-current" />
                <span>Usar los colores y tipografías de la plantilla<span className="block text-xs text-muted">Reemplaza los colores de abajo.</span></span>
              </label>
            </div>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold">Colores</legend>
              {color("primaryColor", "Principal (botones)", e)}
              {color("accentColor", "Acento", e)}
              {color("backgroundColor", "Fondo", e)}
              {color("textColor", "Texto", e)}
              <div className="flex flex-wrap items-center gap-3 rounded-theme border border-line p-3 text-sm sm:col-span-2" style={{ background: colors.backgroundColor, color: colors.textColor }} aria-hidden>
                <span>Vista previa del texto</span>
                <span className="rounded-theme px-3 py-1.5" style={{ background: colors.primaryColor, color: HEX_COLOR.test(colors.primaryColor) ? readableOn(colors.primaryColor) : "#fff" }}>Agregar al carrito</span>
                <span style={{ color: colors.accentColor }}>Oferta</span>
              </div>
            </fieldset>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold">Tipografías y estilo</legend>
              <Field label="Títulos" error={e.headingFont}>{(p) => <Select {...p} name="headingFont" defaultValue={values.headingFont}>{Object.entries(fonts).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
              <Field label="Textos" error={e.bodyFont}>{(p) => <Select {...p} name="bodyFont" defaultValue={values.bodyFont}>{Object.entries(fonts).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
              <Field label="Títulos en mayúscula">{(p) => <Select {...p} name="headingCase" defaultValue={values.headingCase}><option value="normal">No</option><option value="upper">Sí</option></Select>}</Field>
              <Field label="Bordes">{(p) => <Select {...p} name="radius" defaultValue={values.radius}><option value="none">Rectos</option><option value="sm">Apenas redondeados</option><option value="md">Redondeados</option><option value="lg">Muy redondeados</option></Select>}</Field>
              <Field label="Portada">{(p) => <Select {...p} name="heroLayout" defaultValue={values.heroLayout}><option value="full">Imagen a pantalla completa</option><option value="split">Imagen y texto lado a lado</option><option value="minimal">Simple</option></Select>}</Field>
              <Field label="Fotos de producto">{(p) => <Select {...p} name="cardStyle" defaultValue={values.cardStyle}><option value="portrait">Verticales</option><option value="square">Cuadradas</option></Select>}</Field>
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">Secciones del inicio</legend>
              <p className="mb-3 text-xs text-muted">Tildá las que querés mostrar y numeralas en el orden en que aparecen.</p>
              {e.homeSections ? <p className="mb-2 text-[13px] text-red-600" role="alert">{e.homeSections}</p> : null}
              <ul className="grid gap-2 sm:grid-cols-2">
                {ordered.map((s) => {
                  const i = values.homeSections.indexOf(s);
                  return (
                    <li key={s} className="flex items-center gap-2 rounded-theme border border-line px-3 py-2 text-sm">
                      <label className="flex flex-1 items-center gap-2"><input type="checkbox" name={`section_${s}`} defaultChecked={i >= 0} className="size-4 accent-current" />{SECTION_LABEL[s] ?? s}</label>
                      <label className="flex items-center gap-1 text-xs text-muted">Orden<span className="w-14"><Input name={`order_${s}`} inputMode="numeric" defaultValue={String(i >= 0 ? i + 1 : ordered.indexOf(s) + 1)} className="h-8 text-sm" aria-label={`Orden de ${SECTION_LABEL[s] ?? s}`} /></span></label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              <Submit pending={pending} size="sm" pendingLabel="Guardando…">Guardar apariencia</Submit>
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">Ver mi tienda</a>
              <Feedback state={state} />
            </div>
          </>
        );
      }}
    </AdminForm>
  );
}
