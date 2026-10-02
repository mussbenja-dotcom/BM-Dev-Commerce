"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { adjustStockAction, duplicateProductAction, saveCategoryAction, saveProductAction, saveVariantAction, setProductActiveAction } from "@/app/admin/productos/actions";
import { AdminForm, Feedback, Submit } from "./form-kit";

type Category = { id: string; name: string };
export type ProductFormValues = {
  id?: string;
  name: string; slug: string; description: string; categoryId: string; brand: string; sku: string;
  price: string; compareAtPrice: string; option1Name: string; option2Name: string;
  active: boolean; featured: boolean; isNew: boolean; seoTitle: string; seoDescription: string; images: string;
};

function Check({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-current" />
      <span>
        {label}
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function ProductForm({ product, categories }: { product: ProductFormValues; categories: Category[] }) {
  const isNew = !product.id;
  return (
    <AdminForm action={saveProductAction} className="flex flex-col gap-5" label={isNew ? "Nuevo producto" : "Editar producto"}>
      {(state, pending) => {
        const e = state?.fieldErrors ?? {};
        return (
          <>
            {product.id ? <input type="hidden" name="productId" value={product.id} /> : null}
            <section className="grid gap-4 rounded-xl border border-line bg-bg p-4 sm:grid-cols-2 sm:p-5">
              <h2 className="text-sm font-semibold sm:col-span-2">Información</h2>
              <Field label="Nombre" error={e.name} className="sm:col-span-2">
                {(p) => <Input {...p} name="name" required maxLength={120} defaultValue={product.name} />}
              </Field>
              <Field label="Descripción" error={e.description} className="sm:col-span-2">
                {(p) => <Textarea {...p} name="description" maxLength={5000} rows={5} defaultValue={product.description} />}
              </Field>
              <Field label="Categoría" error={e.categoryId}>
                {(p) => (
                  <Select {...p} name="categoryId" defaultValue={product.categoryId}>
                    <option value="">Sin categoría</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Marca (opcional)" error={e.brand}>
                {(p) => <Input {...p} name="brand" maxLength={60} defaultValue={product.brand} />}
              </Field>
            </section>

            <section className="grid gap-4 rounded-xl border border-line bg-bg p-4 sm:grid-cols-2 sm:p-5">
              <h2 className="text-sm font-semibold sm:col-span-2">Precio y código</h2>
              <Field label="Precio de venta" error={e.price} hint="En pesos, sin centavos.">
                {(p) => <Input {...p} name="price" inputMode="numeric" required defaultValue={product.price} />}
              </Field>
              <Field label="Precio anterior (opcional)" error={e.compareAtPrice} hint="Se muestra tachado como oferta.">
                {(p) => <Input {...p} name="compareAtPrice" inputMode="numeric" defaultValue={product.compareAtPrice} />}
              </Field>
              <Field label="SKU (código interno)" error={e.sku} hint={isNew ? "También es el código de la primera variante." : undefined}>
                {(p) => <Input {...p} name="sku" required maxLength={60} defaultValue={product.sku} />}
              </Field>
              {isNew ? (
                <Field label="Stock inicial" error={e._ ?? e.initialStock}>
                  {(p) => <Input {...p} name="initialStock" inputMode="numeric" defaultValue="0" />}
                </Field>
              ) : null}
            </section>

            <section className="grid gap-4 rounded-xl border border-line bg-bg p-4 sm:grid-cols-2 sm:p-5">
              <div className="sm:col-span-2">
                <h2 className="text-sm font-semibold">Opciones</h2>
                <p className="mt-1 text-xs text-muted">Si el producto tiene talles, colores o sabores, nombrá las opciones. Cada combinación es una variante con su propio stock.</p>
              </div>
              <Field label="Opción 1 (ej. Talle)" error={e.option1Name}>
                {(p) => <Input {...p} name="option1Name" maxLength={30} defaultValue={product.option1Name} />}
              </Field>
              <Field label="Opción 2 (ej. Color)" error={e.option2Name}>
                {(p) => <Input {...p} name="option2Name" maxLength={30} defaultValue={product.option2Name} />}
              </Field>
            </section>

            <section className="grid gap-4 rounded-xl border border-line bg-bg p-4 sm:p-5">
              <h2 className="text-sm font-semibold">Imágenes</h2>
              <Field label="URLs de imágenes" error={e.images ?? Object.entries(e).find(([k]) => k.startsWith("images."))?.[1]} hint="Una por línea, hasta 8. La primera es la principal.">
                {(p) => <Textarea {...p} name="images" rows={4} defaultValue={product.images} placeholder="https://…" className="font-mono text-[13px]" />}
              </Field>
            </section>

            <section className="grid gap-3 rounded-xl border border-line bg-bg p-4 sm:p-5">
              <h2 className="text-sm font-semibold">Visibilidad</h2>
              <Check name="active" label="Visible en la tienda" defaultChecked={product.active} />
              <Check name="featured" label="Destacado" hint="Aparece en la sección de destacados del inicio." defaultChecked={product.featured} />
              <Check name="isNew" label="Novedad" defaultChecked={product.isNew} />
            </section>

            <details className="rounded-xl border border-line bg-bg p-4 sm:p-5">
              <summary className="cursor-pointer text-sm font-semibold">Buscadores (opcional)</summary>
              <div className="mt-4 grid gap-4">
                <Field label="Dirección del producto" error={e.slug} hint="Se genera desde el nombre si la dejás vacía.">
                  {(p) => <Input {...p} name="slug" maxLength={80} defaultValue={product.slug} />}
                </Field>
                <Field label="Título para buscadores" error={e.seoTitle}>
                  {(p) => <Input {...p} name="seoTitle" maxLength={70} defaultValue={product.seoTitle} />}
                </Field>
                <Field label="Descripción para buscadores" error={e.seoDescription}>
                  {(p) => <Textarea {...p} name="seoDescription" maxLength={160} rows={2} defaultValue={product.seoDescription} />}
                </Field>
              </div>
            </details>

            <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
              <Submit pending={pending} pendingLabel="Guardando…">{isNew ? "Crear producto" : "Guardar cambios"}</Submit>
              <Feedback state={state} />
            </div>
          </>
        );
      }}
    </AdminForm>
  );
}

export function ProductActiveForm({ productId, active }: { productId: string; active: boolean }) {
  return (
    <AdminForm action={setProductActiveAction} className="flex flex-col items-end gap-1">
      {(state, pending) => (
        <>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="active" value={String(!active)} />
          <Submit pending={pending} pendingLabel="Guardando…" variant="secondary" size="sm">
            {active ? "Ocultar de la tienda" : "Mostrar en la tienda"}
          </Submit>
          <Feedback state={state} />
        </>
      )}
    </AdminForm>
  );
}

export type VariantValues = { id?: string; sku: string; option1: string; option2: string; colorHex: string; price: string; lowStockAlert: string; active: boolean };

export function VariantForm({ productId, variant, optionNames, onDone }: { productId: string; variant: VariantValues; optionNames: [string, string]; onDone?: () => void }) {
  const isNew = !variant.id;
  return (
    <AdminForm action={saveVariantAction} resetOnSuccess={isNew} className="grid gap-3 sm:grid-cols-3" label={isNew ? "Nueva variante" : `Editar variante ${variant.sku}`}>
      {(state, pending) => {
        const e = state?.fieldErrors ?? {};
        return (
          <>
            <input type="hidden" name="productId" value={productId} />
            {variant.id ? <input type="hidden" name="variantId" value={variant.id} /> : null}
            <Field label={optionNames[0] || "Opción 1"} error={e.option1}>
              {(p) => <Input {...p} name="option1" maxLength={40} defaultValue={variant.option1} />}
            </Field>
            <Field label={optionNames[1] || "Opción 2"} error={e.option2}>
              {(p) => <Input {...p} name="option2" maxLength={40} defaultValue={variant.option2} />}
            </Field>
            <Field label="SKU" error={e.sku}>
              {(p) => <Input {...p} name="sku" required maxLength={60} defaultValue={variant.sku} />}
            </Field>
            <Field label="Precio propio (opcional)" error={e.price} hint="Vacío = precio del producto.">
              {(p) => <Input {...p} name="price" inputMode="numeric" defaultValue={variant.price} />}
            </Field>
            <Field label="Avisar con stock ≤" error={e.lowStockAlert}>
              {(p) => <Input {...p} name="lowStockAlert" inputMode="numeric" defaultValue={variant.lowStockAlert} />}
            </Field>
            <Field label="Color (opcional)" error={e.colorHex} hint="Ej. #1a1a1a">
              {(p) => <Input {...p} name="colorHex" maxLength={7} defaultValue={variant.colorHex} />}
            </Field>
            {isNew ? (
              <Field label="Stock inicial" error={e._}>
                {(p) => <Input {...p} name="initialStock" inputMode="numeric" defaultValue="0" />}
              </Field>
            ) : null}
            <label className="flex items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" name="active" defaultChecked={variant.active} className="size-4 accent-current" /> A la venta
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
              <Submit pending={pending} size="sm" pendingLabel="Guardando…">{isNew ? "Agregar variante" : "Guardar variante"}</Submit>
              {onDone ? <Button variant="ghost" size="sm" onClick={onDone}>Cerrar</Button> : null}
              <Feedback state={state} />
            </div>
          </>
        );
      }}
    </AdminForm>
  );
}

export function EditVariantToggle({ productId, variant, optionNames }: { productId: string; variant: VariantValues; optionNames: [string, string] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Editar</Button>;
  return (
    <div className="mt-3 w-full rounded-lg border border-line bg-surface p-3">
      <VariantForm productId={productId} variant={variant} optionNames={optionNames} onDone={() => setOpen(false)} />
    </div>
  );
}

export function StockForm({ variantId, stock, label }: { variantId: string; stock: number; label: string }) {
  return (
    <AdminForm action={adjustStockAction} resetOnSuccess className="flex flex-col gap-2" label={`Ajustar stock de ${label}`}>
      {(state, pending) => (
        <>
          <input type="hidden" name="variantId" value={variantId} />
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] gap-2 sm:grid-cols-[9rem_5.5rem_minmax(10rem,1fr)_auto]">
            <label>
              <span className="sr-only">Tipo de ajuste</span>
              <Select name="mode" defaultValue="add" className="h-10">
                <option value="add">Ingresar</option>
                <option value="remove">Descontar</option>
                <option value="set">Contar (fijar)</option>
              </Select>
            </label>
            <label>
              <span className="sr-only">Cantidad</span>
              <Input name="quantity" inputMode="numeric" placeholder="Cant." className="h-10" aria-invalid={!!state?.fieldErrors?.quantity} />
            </label>
            <label className="col-span-3 row-start-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">
              <span className="sr-only">Motivo</span>
              <Input name="note" maxLength={200} placeholder="Motivo (opcional)" className="h-10" />
            </label>
            <Submit pending={pending} size="sm" variant="secondary" className="h-10" pendingLabel="Guardando…">Ajustar</Submit>
          </div>
          <p className="text-xs text-muted">Stock actual: {stock}</p>
          <Feedback state={state} />
        </>
      )}
    </AdminForm>
  );
}

export type CategoryValues = { id?: string; name: string; description: string; imageUrl: string; position: string; active: boolean };

export function CategoryForm({ category }: { category: CategoryValues }) {
  const isNew = !category.id;
  return (
    <AdminForm action={saveCategoryAction} resetOnSuccess={isNew} className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem]" label={isNew ? "Nueva categoría" : `Editar categoría ${category.name}`}>
      {(state, pending) => {
        const e = state?.fieldErrors ?? {};
        return (
          <>
            {category.id ? <input type="hidden" name="categoryId" value={category.id} /> : null}
            <Field label="Nombre" error={e.name}>
              {(p) => <Input {...p} name="name" required maxLength={60} defaultValue={category.name} />}
            </Field>
            <Field label="Imagen (URL, opcional)" error={e.imageUrl}>
              {(p) => <Input {...p} name="imageUrl" maxLength={500} defaultValue={category.imageUrl} placeholder="https://…" />}
            </Field>
            <Field label="Orden" error={e.position}>
              {(p) => <Input {...p} name="position" inputMode="numeric" defaultValue={category.position} />}
            </Field>
            <Field label="Descripción (opcional)" error={e.description} className="sm:col-span-2">
              {(p) => <Input {...p} name="description" maxLength={300} defaultValue={category.description} />}
            </Field>
            <label className="flex items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" name="active" defaultChecked={category.active} className="size-4 accent-current" /> Visible
            </label>
            <div className="flex items-center gap-3 sm:col-span-3">
              <Submit pending={pending} size="sm" pendingLabel="Guardando…">{isNew ? "Crear categoría" : "Guardar"}</Submit>
              <Feedback state={state} />
            </div>
          </>
        );
      }}
    </AdminForm>
  );
}

export function DuplicateProductForm({ productId }: { productId: string }) {
  return (
    <AdminForm action={duplicateProductAction} className="flex flex-col items-end gap-1">
      {(state, pending) => (
        <>
          <input type="hidden" name="productId" value={productId} />
          <Submit pending={pending} pendingLabel="Duplicando…" variant="secondary" size="sm">Duplicar</Submit>
          <Feedback state={state} />
        </>
      )}
    </AdminForm>
  );
}
