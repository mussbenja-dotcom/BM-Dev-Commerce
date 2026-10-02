import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoreBySlug, getStoreBase, getStoreOrigin } from "@/lib/store/resolve";
import { JsonLd } from "./json-ld";
import { getFacets, listProducts, SORT_OPTIONS, type SortKey } from "@/lib/services/catalog";
import { ProductCard } from "./product-card";
import { CatalogFilters } from "./catalog-filters";
import { buttonClasses } from "@/components/ui/button";

export type SearchParams = Record<string, string | string[] | undefined>;
export async function CatalogPage({ slug, category, search }: { slug: string; category?: string; search: SearchParams }) {
  const store = await getStoreBySlug(slug);
  if (!store?.theme) notFound();
  const selectedCategory = category ? store.categories.find((c) => c.slug === category) : null;
  if (category && !selectedCategory) notFound();
  const one = (key: string) => typeof search[key] === "string" ? search[key] as string : "";
  const many = (key: string) => Array.isArray(search[key]) ? search[key] as string[] : one(key) ? [one(key)] : [];
  const number = (key: string) => one(key) && Number.isFinite(Number(one(key))) ? Math.max(0, Math.min(2_000_000_000, Math.floor(Number(one(key))))) : undefined;
  const categorySlug = category ?? one("categoria");
  const sort = Object.hasOwn(SORT_OPTIONS, one("orden")) ? one("orden") as SortKey : "relevancia";
  const [base, origin, facets, result] = await Promise.all([getStoreBase(slug), getStoreOrigin(store), getFacets(store.id, categorySlug), listProducts(store.id, { q: one("q"), category: categorySlug, sizes: many("talle"), colors: many("color"), brands: many("marca"), minPrice: number("min"), maxPrice: number("max"), inStock: one("stock") === "1", onSale: one("oferta") === "1", sort, page: number("pagina") || 1 })]);
  const path = `${base}${category ? `/categorias/${category}` : "/productos"}`;
  const pageHref = (page: number) => { const params = new URLSearchParams(); for (const [key, value] of Object.entries(search)) { if (key !== "pagina" && value) for (const v of Array.isArray(value) ? value : [value]) params.append(key, v); } params.set("pagina", String(page)); return `${path}?${params}`; };
  const control = "mt-2 w-full border border-line bg-bg p-2.5 text-sm";
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: store.name, item: origin }, { "@type": "ListItem", position: 2, name: selectedCategory?.name ?? "Productos", item: `${origin}${category ? `/categorias/${category}` : "/productos"}` }] };
  return <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><JsonLd data={breadcrumb} /><p className="mb-4 text-xs text-muted"><Link href={base || "/"}>Inicio</Link> / {selectedCategory?.name ?? "Productos"}</p><div className="mb-9 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-heading text-3xl sm:text-4xl">{selectedCategory?.name ?? (one("q") ? `Resultados para “${one("q")}"` : "Todos los productos")}</h1>{selectedCategory?.description && <p className="mt-3 text-sm text-muted">{selectedCategory.description}</p>}</div><p className="text-sm text-muted">{result.total} productos</p></div>
    <div className="lg:flex lg:gap-10"><CatalogFilters><form action={path} className="space-y-6">
      <div><label htmlFor="catalog-q" className="block text-sm font-medium">Buscar</label><input id="catalog-q" name="q" defaultValue={one("q")} className={control} /></div>
      <div><label htmlFor="catalog-orden" className="block text-sm font-medium">Ordenar</label><select id="catalog-orden" name="orden" defaultValue={sort} className={control}>{Object.entries(SORT_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      {!category && <div><label htmlFor="catalog-categoria" className="block text-sm font-medium">Categoría</label><select id="catalog-categoria" name="categoria" defaultValue={categorySlug} className={control}><option value="">Todas</option>{store.categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>}
      {[{ title: "Talle / opción", name: "talle", values: facets.sizes }, { title: "Color", name: "color", values: facets.colors.map((c) => c.name) }, { title: "Marca", name: "marca", values: facets.brands }].map((facet) => facet.values.length > 0 && <fieldset key={facet.name}><legend className="mb-3 text-sm font-medium">{facet.title}</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{facet.values.map((value) => <label key={value} className="flex items-center gap-2 text-sm"><input type="checkbox" name={facet.name} value={value} defaultChecked={many(facet.name).includes(value)} className="accent-current" />{value}</label>)}</div></fieldset>)}
      <fieldset><legend className="text-sm font-medium">Precio</legend><div className="flex gap-2"><label className="min-w-0 flex-1 text-xs">Desde<input type="number" name="min" min={0} defaultValue={number("min")} className={control} /></label><label className="min-w-0 flex-1 text-xs">Hasta<input type="number" name="max" min={0} defaultValue={number("max")} className={control} /></label></div></fieldset>
      <label className="flex items-center gap-2 text-sm"><input name="stock" type="checkbox" value="1" defaultChecked={one("stock") === "1"} />Solo con stock</label><label className="flex items-center gap-2 text-sm"><input name="oferta" type="checkbox" value="1" defaultChecked={one("oferta") === "1"} />En oferta</label>
      <button type="submit" className={buttonClasses("primary", "md", "w-full")}>Aplicar filtros</button><Link href={path} className="block text-center text-sm underline">Limpiar filtros</Link>
    </form></CatalogFilters>
    <div className="min-w-0 flex-1">{result.items.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3">{result.items.map((p) => <ProductCard key={p.id} product={p} base={base} square={store.theme!.cardStyle === "square"} />)}</div> : <div className="bg-surface px-5 py-16 text-center"><p>No encontramos productos con esos filtros.</p><Link href={path} className="mt-4 inline-block underline">Ver todos</Link></div>}
      <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-5 text-sm">{result.page > 1 && <Link href={pageHref(result.page - 1)} className="underline">Anterior</Link>}<span>Página {result.page} de {result.pageCount}</span>{result.page < result.pageCount && <Link href={pageHref(result.page + 1)} className="underline">Siguiente</Link>}</nav>
    </div></div>
  </div>;
}
