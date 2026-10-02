# Estado actual — BM Dev Commerce Engine

- **Fecha:** 2026-10-02
- **Branch de trabajo:** `claude/wizardly-cerf-94tq6p` (sesión de Claude Code en la web). `main` ya tiene todo lo anterior (PR #1 mergeado: landing + panel `/admin` completo).
- **Hitos de esta sesión:** fix e2e de filtros → landing comercial con leads → `/admin` productos, promociones, clientes y configuración → **`/superadmin`** (solicitudes, tiendas, dominios, usuarios, modo soporte).
- **URLs para revisar:** `/` (landing) · `/login` → "Entrar al panel de la tienda demo" → `/admin` · `/login` con `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` del `.env` → `/superadmin`.

## Próximo paso exacto

1. **En tu máquina:** `git pull` en `main` y `npm run db:deploy` (migraciones `20261002020158_leads` y `*_lead_notes_store`). Opcional `npm run db:seed` (solo recrea tiendas demo; actualiza CBU/CUIT ficticios válidos y crea el superadmin si está en `.env`).
2. **`/demo`:** selector de rubros con las 5 demos, "ver tienda" y "ver el panel" (login demo). La landing ya enlaza a `/s/<demo>`; falta la página dedicada.
3. **SEO:** `sitemap.xml` y `robots.txt` (incluir `/tienda-online`; excluir `/admin`, `/superadmin`, `/login`, checkout/pedido), canonical y Open Graph por tienda, JSON-LD de producto.
4. **Imágenes:** subida de archivos (Cloudinary o `/public/uploads`) para productos, logo y categorías; hoy son URLs.
5. **Mercado Pago real:** carga de credenciales por tienda desde `/superadmin` (cifradas con `ENCRYPTION_KEY`) y prueba en SANDBOX con HTTPS antes de ofrecer cobros reales.
6. Personalización visual desde el panel (colores, plantilla, secciones del inicio). Al cerrar cada hito: typecheck, lint, tests, build, e2e, actualizar este archivo, commit y push.

## Verificar en local (lo que la sesión web no pudo ver)

- **Identidad visual:** `bmdev.solutions` está bloqueado por la red del contenedor web, así que no se pudo revisar. La landing usa la identidad que ya tenía la plataforma (marca "BM", Manrope, tinta `#111318`, naranja `#e8551f`; CTA `#c43e0c` para contraste AA con texto blanco). Los colores están en un solo objeto `BRAND` en `src/components/landing/landing-page.tsx`: ajustarlos ahí si la web de BM Dev usa otros.
- **Fotos de las demos:** Unsplash también está bloqueado en el contenedor, así que en las capturas de la sesión las previews se ven con placeholders. En tu máquina deberían verse las fotos reales de cada demo.
- Las e2e/integración de esta sesión corrieron contra un PostgreSQL 16 local del contenedor (no PGlite), con `DATABASE_POOL_MAX=5`.

## Hitos implementados

### Panel interno `/superadmin` (esta sesión)

- Solo `SUPERADMIN_BMDEV` (`requireSuperadmin` en cada página y acción; un comercio que entra a `/superadmin` vuelve a `/admin`). Nav: Inicio, Solicitudes (contador de nuevas), Tiendas.
- **Inicio:** solicitudes nuevas, tiendas activas y en borrador, ventas de 30 días, últimas solicitudes.
- **Solicitudes** (`/superadmin/solicitudes`): pestañas por estado (Nueva, Contactada, Presupuesto enviado, Ganada, Perdida, Spam; "Todas" oculta spam), búsqueda, detalle con lo que contó el comercio, WhatsApp/email, estado y notas internas, y "Crear tienda desde esta solicitud".
- **Tiendas:** listado con búsqueda y estado; **alta** (`provisionStore`) en borrador con plantilla, categorías, envíos y cupón de ejemplo; el dueño recibe una **contraseña temporal** que se muestra una sola vez (solo se guarda el hash). Si viene de una solicitud, la solicitud queda Ganada y enlazada a la tienda (`Lead.storeId`).
- **Detalle de tienda:** nombre, estado (borrador / activa / suspendida), plan y notas; dominios (agregar —acepta `https://www.x.com/` y lo normaliza—, principal, verificado, quitar); usuarios (agregar administrador con contraseña temporal, nueva contraseña —cierra sus sesiones—, desactivar/reactivar; nunca se borran); actividad reciente; métricas.
- **Modo soporte:** "Entrar en modo soporte" abre el `/admin` de esa tienda con aviso y botón "Salir del modo soporte" (vuelve al detalle). Audit `support.enter/exit`.
- Migración `*_lead_notes_store`: `Lead.notes` y `Lead.storeId` (FK con `SET NULL`), solo agrega columnas.
- Archivos: `src/app/superadmin/*`, `src/components/superadmin/{nav,forms}.tsx`, `src/lib/services/superadmin/{rules,leads,stores}.ts` (+ `rules.test.ts`).
- Pendiente aquí: credenciales de Mercado Pago por tienda, reset de demos, impersonar con auditoría más detallada.

### Fix e2e filtros (`44772f2`)

- Causa: con el modal "Filtros" abierto, el formulario existía dos veces (sidebar oculto + modal) y los `<select>` estaban envueltos por su `<label>`, cuyo texto incluía todas las opciones ("OrdenarDestacadosMás nuevos…"). `getByLabel("Ordenar", { exact: true })` no encontraba nada.
- `CatalogFilters` ahora renderiza el formulario en un solo lugar a la vez (el sidebar desmonta su copia mientras el modal está abierto) y Buscar/Ordenar/Categoría usan `htmlFor` + `id`.
- `playwright.config.ts` acepta `PLAYWRIGHT_CHROMIUM_PATH` opcional para usar un Chromium preinstalado (entornos en la nube). Sin la variable no cambia nada.

### Panel `/admin/configuracion` (esta sesión)

- Nav: "Configuración". Secciones con su propio formulario: tienda (nombre, frase, descripción, anuncio, logo, ícono, pie, SEO), contacto (WhatsApp, email, redes, dirección, provincia de la lista, horarios), pagos, envíos y retiro, políticas. Todo revalida la tienda pública.
- **Pagos:** activar/desactivar Mercado Pago, transferencia, efectivo y pedido por WhatsApp; descuento por transferencia (0–50 %), cuotas informativas, datos bancarios. Validación: al menos un medio que el cliente pueda usar; transferencia exige titular y alias o CBU; CBU/CVU y CUIT con dígitos verificadores (`settings-rules.ts`). El token de Mercado Pago nunca sale del servidor; el panel solo muestra si está conectado. **Decisión:** las credenciales de MP no se cargan desde el panel del comercio (las configura BM Dev hasta validar cobros reales).
- **Envíos:** monto para envío gratis; formas de entrega (envío o retiro, costo, provincias de la lista —ninguna = todo el país—, demora, disponible, orden). Se desactivan, no se borran (los pedidos las referencian). El retiro ignora provincias.
- **Seed:** el CBU y CUIT ficticios de las demos no pasaban los dígitos verificadores; se cambiaron por `0070999000000000000017` y `30-00000000-7`. Tus bases locales conservan los viejos hasta que corras `npm run db:seed` (solo recrea tiendas demo); mientras tanto, guardar "Pagos" en una demo pide corregir el CBU.
- `Disclosure` en `form-kit.tsx`: `<details>` que no se cierra al re-renderizar después de guardar.

### Panel `/admin/clientes` (esta sesión)

- Nav: "Clientes". Solo lectura: los clientes los crea el checkout. Listado con búsqueda (nombre, email, teléfono), orden (recientes, más compraron, más pedidos), totales de la tienda, paginación. Detalle con pedidos (link a cada uno), ticket promedio, direcciones, email y WhatsApp.
- `GET /admin/clientes/exportar`: CSV con `;` y BOM (Excel en español), `Cache-Control: private, no-store`, audit `customers.export`. `src/lib/csv.ts` neutraliza celdas que empiezan con `= + - @` (inyección de fórmulas), con tests.
- Todo filtra por `storeId`; un cliente de otra tienda → 404.

### Panel `/admin/promociones` (esta sesión)

- Nav: "Promociones". Crear y editar cupones: porcentaje (1–100), monto fijo o envío gratis; compra mínima, límite de usos, vigencia desde/hasta (fechas en hora argentina; "hasta" vale hasta las 23:59), descripción interna, activo. Estado calculado igual que el checkout: vigente, programado, vencido, sin usos, pausado.
- Códigos normalizados en mayúsculas sin espacios (`qa 20` → `QA20`), únicos por tienda.
- **Decisiones:** los cupones se pausan, no se borran; un cupón ya usado no puede cambiar de código (los pedidos guardan el código y la cancelación lo descuenta por código); el límite de usos no puede bajar de los usos ya hechos (la edición bloquea la fila con `FOR UPDATE`).
- Reglas en `src/lib/services/admin/coupon-rules.ts` (+ tests), servicio `coupons.ts`, acciones `src/app/admin/promociones/actions.ts` (audit `coupon.*`).

### Panel `/admin/productos` (esta sesión)

- Nav: "Productos". `/admin/productos` (búsqueda por nombre/SKU/marca/SKU de variante, filtro por categoría y estado: visibles, ocultos, stock bajo; paginación), `/admin/productos/nuevo`, `/admin/productos/[id]`, `/admin/productos/categorias`.
- Alta: crea el producto **y su primera variante** (mismo SKU) con stock inicial y movimiento `INITIAL`. Slug derivado del nombre con sufijo `-2`, `-3` si se repite; un slug explícito repetido se informa en el campo. Precio anterior debe ser mayor al de venta. Imágenes por URL https (una por línea, hasta 8; la primera es la principal). Subida de archivos sigue pendiente.
- Variantes: opciones, SKU (normalizado en mayúsculas, único por tienda), precio propio opcional, color, umbral de stock bajo, a la venta sí/no. Combinación de opciones repetida → error.
- Stock: ajuste manual "Ingresar / Descontar / Contar (fijar)" con motivo. `adjustStock` bloquea la fila de la variante (`SELECT … FOR UPDATE`), nunca deja stock negativo y registra `ADJUSTMENT` con delta y stock resultante. Historial de los últimos 30 movimientos por producto (inicial, venta, ajuste, cancelación).
- **Decisión:** los productos no se borran, se ocultan ("Ocultar de la tienda"): los pedidos viejos siguen apuntando a ellos. Lo mismo para variantes ("a la venta" no) y categorías ("visible" no).
- Renombrar una categoría cambia su slug (y su URL pública `/categorias/<slug>`).
- Reglas puras en `src/lib/services/admin/product-rules.ts` (+ tests); servicio `products.ts` filtra todo por `storeId`; acciones en `src/app/admin/productos/actions.ts` con Zod + audit (`product.*`, `variant.*`, `stock.adjust`, `category.*`) y revalidan la tienda pública.
- `src/components/admin/form-kit.tsx`: `AdminForm` (envía con transición para no perder lo escrito si el servidor rechaza), `Submit`, `Feedback`. `order-actions.tsx` reutiliza `Submit`/`Feedback` de ahí.

### Landing comercial BM Dev E-commerce (esta sesión)

- `/tienda-online` y `/` muestran la misma landing (`src/app/tienda-online/landing.tsx`); canonical y Open Graph apuntan a `/tienda-online`. `/` ya no es create-next-app. Ambas son dinámicas (`connection()`), así el build no necesita base.
- Secciones del brief en orden: hero, ejemplos por rubro (las 5 demos con sus colores, tagline y productos reales), qué incluye (15 ítems), personalización, cómo funciona (4 pasos), demo (previews computadora / celular / panel + links a `/s/<demo>` y "Ver el panel del comercio" con `demoLoginAction` si `DEMO_LOGIN_ENABLED`), diferenciales (incluye "sin comisión de BM Dev por venta" y que los costos de procesamiento son del medio de pago), formulario y CTA final. Barra fija mobile con "Solicitar presupuesto" + WhatsApp.
- Sin precios del servicio, sin catálogo/carrito propios, sin mencionar tecnología (lo verifica la e2e). Las previews son dibujos en HTML/CSS con datos reales de las demos (`src/components/landing/previews.tsx`), no capturas: no se rompen si cambia una demo. Si la base falla, la landing igual se muestra sin la sección de demos.
- **WhatsApp:** `src/lib/bmdev.ts` → `bmdevWhatsappUrl()` es el único lugar que lee `BMDEV_WHATSAPP`; devuelve `null` si falta y los botones se ocultan. Mensaje del brief en `bmdevInterestMessage()` (`src/lib/services/leads/form.ts`); después de enviar el formulario se ofrece WhatsApp con negocio, rubro e Instagram ya completos.
- **Leads:** modelo `Lead` + enum `LeadStatus` (NEW, CONTACTED, QUALIFIED, WON, LOST, SPAM), migración `20261002020158_leads` (solo agrega tabla y enum). Es de plataforma: no tiene `storeId`.
  - `src/lib/services/leads/form.ts` (sin `server-only`): opciones, esquema Zod, normalización (WhatsApp solo dígitos, Instagram sin @/URL, email en minúsculas), mensajes en español.
  - `src/lib/services/leads/submit.ts`: honeypot `sitio_web` (responde éxito y no guarda), validación, rate limit en memoria (5/hora por IP y 3/día por email+WhatsApp), guarda IP.
  - `src/app/tienda-online/actions.ts`: Server Action, audit `lead.created`, errores por campo.
  - `src/components/landing/lead-form.tsx`: envía con `startTransition` para no perder lo escrito cuando hay errores; sin JS sigue funcionando el POST nativo.

### Servicio de pagos (`72976c0`)

- `src/lib/services/payments/mercadopago.ts`: preferencias con total del servidor en pesos enteros, metadata de tienda, URLs propias, SANDBOX/PRODUCTION.
- `POST /api/webhooks/mercadopago/[storeId]`: consulta el pago con el token del comercio; valida ID, tienda, monto, moneda ARS y ambiente. El cuerpo del webhook nunca acredita un pago directamente.
- `applyPaymentResult`: bloqueo de la fila del pedido, resultado idempotente, un evento por cambio, protección contra regresiones PAID/REFUNDED. Un pago tardío se registra sin reabrir un pedido cancelado.
- Solo tiendas `isDemo` pueden simular pagos. Un comercio real sin token configurado no puede generar un pago ficticio.
- Sin token/firma de webhook configurados para producción; no hubo prueba de cobro real.

### Storefront y checkout

- `/s/[slug]`: layout con tema, proveedores públicos y carrito por tienda; anuncio, logo/nombre, búsqueda con sugerencias, menú móvil, categorías, footer, políticas y WhatsApp.
- Home por `theme.homeSections`: hero, categorías, novedades, destacados, ofertas, más vendidos, banners, beneficios e Instagram. Las cinco demos usan sus datos y estilos.
- `/productos` y `/categorias/[category]`: búsqueda, categorías, variantes, color, marca, precio, stock, oferta, orden y paginación; sidebar desktop y modal de filtros móvil.
- `/productos/[product]`: galería con ampliación, opciones de variante, stock, cantidad, cuotas, transferencia, agregar, comprar ahora, consulta por WhatsApp y relacionados.
- Carrito: cantidades, eliminar, cupón, envío por provincia, progreso a envío gratis, cotización del servidor y acceso al checkout / pedido por WhatsApp. No se muestran como vigentes cotizaciones de un carrito anterior.
- `/checkout`: datos del comprador, envío o retiro, pago y resumen cotizado. No se aceptan precios del navegador.
- `POST /api/store/[slug]/orders`: origen, rate limit, validación, disponibilidad de medios, creación transaccional y respuesta según pago. `checkoutKey` impide duplicar el pedido/stock ante reintentos, incluso simultáneos.
- `/pedido/[token]`: estado persistido, importes, entrega, datos bancarios, WhatsApp y reintento de Mercado Pago. Token + tienda delimitan el acceso. Metadata noindex.
- `/pago/[token]` y `POST /api/store/[slug]/orders/[token]/payment`: simulación aprobada, pendiente y rechazada con comprobaciones en el servidor. Reintento tras rechazo. Un parámetro de retorno no acredita un pago.
- WhatsApp abre un mensaje construido desde el pedido persistido. Se genera el enlace; no se enviaron mensajes a terceros durante QA.
- El checkout que ya creó el pedido pero no pudo iniciar Mercado Pago devuelve una confirmación recuperable, sin volver a descontar stock.

### Panel `/admin` — pedidos (esta sesión)

- `src/app/admin/layout.tsx`: `requireStoreSession()`, sidebar desktop / barra mobile, contador de pedidos nuevos, "Ver tienda", salir, aviso de demo o modo soporte. Navegación solo con pantallas existentes (`src/components/admin/nav.tsx`).
- `/admin`: ventas de hoy y del mes (excluye cancelados), pedidos nuevos, pagos pendientes, últimos pedidos, barras de 7 días, stock bajo (`stock <= lowStockAlert`).
- `/admin/pedidos`: pestañas por estado con conteos, búsqueda por número/nombre/email/teléfono, filtro de pago, paginación de 20, tabla desktop y tarjetas mobile.
- `/admin/pedidos/[id]`: productos, totales, cliente (+WhatsApp), entrega, pago, historial con notas internas. En mobile los controles van primero.
- Reglas puras en `src/lib/services/admin/order-rules.ts` (+ tests): estados solo hacia adelante (se pueden saltear pasos); entregado y cancelado cerrados; no se cancela un entregado.
- Servicio `src/lib/services/admin/orders.ts`: todas las consultas filtran por `storeId` de la sesión; mutaciones con `SELECT … FOR UPDATE` sobre el pedido (misma serialización que el webhook de MP).
- **Cancelación:** repone stock una sola vez (`CANCEL_RESTOCK`), descuenta `soldCount`, libera el uso del cupón, revierte `ordersCount/totalSpent` del cliente y registra un evento. Segunda cancelación → error, sin reponer de nuevo. Variantes borradas se informan en el evento.
- **Decisión pagos:** cancelar un pedido PAGADO exige tildar que el comercio gestiona el reintegro; el estado de pago **sigue PAID** (no se hace reembolso en MP). Aviso visible en el detalle. En métodos manuales (transferencia/efectivo/WhatsApp) el comercio puede marcar pagado (NEW pasa a CONFIRMED), volver a pendiente o reintegrado. El estado de pagos de Mercado Pago **no se edita a mano**.
- Server Actions en `src/app/admin/pedidos/actions.ts`: Zod, sesión fuera de `run()` (para no tragar el redirect), audit log `order.*`, `revalidatePath`. Cancelar revalida también la tienda pública.

## Arquitectura y decisiones

- Next.js 16.3.8 App Router, React 19, TypeScript, Tailwind 4, Prisma 7.10 con adapter pg, Zod 4. Leer las guías locales en `node_modules/next/dist/docs/` antes de tocar convenciones de Next.
- `package.json` declara `type: module` para compatibilidad del cliente Prisma generado con Playwright. El seed usa `new URL(..., import.meta.url)` en lugar de `__dirname`; se verificó ejecutándolo en QA.
- Todas las entidades comerciales tienen `storeId`; las páginas/API cargan tiendas ACTIVE. El cliente recibe una selección explícita de campos públicos, no tokens cifrados ni settings completos.
- `src/lib/store/resolve.ts`: contexto de tienda, base de enlaces y origen; `proxy.ts` reescribe dominios propios a `/s/[slug]`. El dominio personalizado real sigue sin probarse.
- Sesiones: cookie httpOnly con token aleatorio; solo SHA-256 en DB; roles y modo soporte existentes.
- `src/lib/pricing.ts` calcula en pesos enteros. Checkout descuenta stock mediante actualización condicional y limita usos de cupones dentro de la transacción.
- `src/lib/db.ts` comparte un cliente entre bundles del servidor. `DATABASE_POOL_MAX` configura el pool; default 10 si se omite.
- No ejecutar procesos QA en paralelo contra la misma instancia PGlite que sirve la UI. Usar una base independiente mediante `E2E_DATABASE_URL`.

## Base de datos

Migraciones aplicadas tanto a la base demo como a QA:

1. `20261002000400_init`
2. `20261002020000_checkout_idempotency`: agrega `Order.checkoutKey` nullable y unique compuesto `(storeId, checkoutKey)`.
3. `20261002020158_leads`: enum `LeadStatus` y tabla `Lead`. **Pendiente de aplicar en tus bases locales** (solo se aplicó en las bases descartables del contenedor web).

Antes de publicar en otro entorno: `npm run db:deploy`.

- Demo local: Prisma dev `bmdev`, PostgreSQL en `localhost:51214`.
- QA local: Prisma dev `bmdev-qa`, PostgreSQL en `localhost:51218`. La CLI imprimió 51218 aunque se solicitaron otros puertos; usar siempre la URL efectiva.
- `.env` local contiene `DATABASE_POOL_MAX=1` y `E2E_DATABASE_URL` de QA. No se commitean secretos.
- `npm run db:seed` recrea solo tiendas `isDemo`; no ejecutarlo para probar cambios sobre datos que se quieran conservar.
- Seed verificado en QA: Alma 23 productos / 149 variantes, Nativa 10 / 11, Mía 10 / 13, Nido 9 / 13, Detalle 8 / 8.

## Verificaciones (hito superadmin)

- typecheck, lint OK. `npm test` 69 OK (+3 contraseña temporal y slug). `npm run test:integration` 26 OK (+3 `superadmin`: alta desde solicitud con hash bcrypt y solicitud ganada, slug/email repetidos, dominios sin cruzar tiendas y principal al quitar, usuarios: alta, reset que cierra sesiones, desactivar sin borrar, sin tocar usuarios de otra tienda). Build OK. `npm run test:e2e` 17 de 17 OK en dos corridas (+2: solicitud → presupuesto → crear tienda → borrador 404 → activa 200 → dominio → modo soporte y salida → la dueña ingresa con la contraseña temporal y no puede abrir `/superadmin`; pantallas a 390 px).

## Verificaciones (hito configuración)

- typecheck, lint OK. `npm test` 66 OK (+8 `settings-rules`). `npm run test:integration` 23 OK (+3 `admin-settings`: token nunca expuesto, medio de pago usable, CBU inválido, aislamiento de datos y formas de entrega, retiro sin provincias, el checkout solo ve formas disponibles). `npm run test:e2e` 15 de 15 OK en dos corridas seguidas (+2: configurar anuncio/pagos/envío y verlo en la tienda; un visitante de la demo guarda Pagos sin tocar nada).

## Verificaciones (hito clientes)

- typecheck, lint OK. `npm test` 58 OK (+3 CSV). `npm run test:integration` 20 OK (+1 `admin-customers`: aislamiento, búsqueda, orden, export). `npm run test:e2e` 13 de 13 OK (+1: listado sin clientes ajenos, descarga del CSV y su contenido, detalle, link de WhatsApp, cliente ajeno → 404).

## Verificaciones (hito promociones)

- typecheck, lint OK. `npm test` 55 OK (+6 `coupon-rules`). `npm run test:integration` 19 OK (+3 `admin-coupons`: un cupón creado en el panel lo acepta `buildQuote` del checkout y deja de valer al pausarlo; código usado no se renombra; límite no baja de los usos; aislamiento entre tiendas). `npm run test:e2e` 12 de 12 OK, dos corridas completas seguidas (+1: crear con error que conserva lo escrito, crear, pausar).
- Se corrigió un selector ambiguo en `tests/e2e/admin-orders.spec.ts` ("Lucía Compradora" aparece en la tabla desktop y en la lista mobile oculta); fallaba de forma intermitente con el suite completo. Ahora apunta a la celda de la tabla.

## Verificaciones (hito productos)

- typecheck, lint OK. `npm test` 49 OK (+8 de `product-rules`). `npm run test:integration` 16 OK (+4 `admin-products`: aislamiento entre dos tiendas en lectura/edición/variantes/stock/categoría ajena, slug con sufijo, SKU repetido, ajustes con historial, dos descuentos simultáneos → solo uno pasa, ocultar no borra). Build OK. `npm run test:e2e` 11 de 11 OK (+2 `admin-catalog`: categoría, alta con error de precio que conserva lo escrito, variante, ajuste inválido y válido, historial, ocultar → 404 en la tienda, producto de otra tienda → 404, pantallas a 390 px sin scroll horizontal).

## Verificaciones (sesión landing, contenedor web con PostgreSQL 16 local)

- `npm run typecheck` OK · `npm run lint` OK.
- `npm test`: 41 OK (30 previas + 9 del formulario/mensaje + 2 del helper de WhatsApp).
- `npm run test:integration`: 12 OK (8 previas + 4 de leads: guarda normalizado, honeypot/invalid no guardan, rate limit por IP y por contacto).
- `npm run build` OK (`/` y `/tienda-online` dinámicas).
- `npm run test:e2e`: 9 de 9 OK. Nuevo `tests/e2e/landing.spec.ts`: `/` y `/tienda-online` a 390 y 1440 px sin scroll horizontal, canonical, sin palabras técnicas, link de WhatsApp con el número de `BMDEV_WHATSAPP` y el mensaje; formulario con errores del servidor que conservan lo escrito, lead guardado; honeypot no guarda.
- Capturas revisadas a 1440 y 390 px (en el contenedor; ver nota de fotos arriba).

## Verificaciones (sesión del panel)

- `npm run typecheck` OK (tras `npm run build`; antes fallaba solo por tipos de rutas viejos en `.next/types`).
- `npm run lint` OK.
- `npm test`: 30 OK (24 previas + 6 de reglas de pedidos).
- `npm run test:integration`: 8 OK. Nuevo `tests/integration/admin-orders.test.ts`: aislamiento entre dos tiendas (lectura, listado, estado, cancelación, pago y notas de otra tienda → "No encontramos el pedido."), estados hacia adelante, doble cancelación simultánea repone stock una vez, cupón y cliente revertidos, pedido pagado exige confirmación, MP no editable a mano. Nota: con `DATABASE_POOL_MAX=1` la concurrencia queda serializada por el pool; en PostgreSQL real la protege el `FOR UPDATE`.
- `npm run build` OK.
- `npm run test:e2e`: 5 de 6 OK. Nuevo `tests/e2e/admin-orders.spec.ts` (login real, dashboard, listado, búsqueda vacía, marcar pagado, cambiar estado, nota, cancelar con confirmación de reintegro, stock repuesto, reintegrado, pedido ajeno → 404, mobile 390 px sin scroll horizontal). Fallaba la de filtros de la tienda; arreglada en `44772f2`.
- Capturas revisadas: `test-results/manual/admin-dashboard-1280.png`, `admin-orders-390.png`, `admin-order-detail-390.png`.
- **Windows/OneDrive:** `next build` falló con `EPERM unlink .next\serverppdmin` porque OneDrive convirtió carpetas de `.next` en marcadores sincronizados (ReparsePoint/ReadOnly). Se resolvió borrando esa carpeta con `Remove-Item -Recurse -Force`. Recomendado: mover el proyecto fuera de OneDrive o excluir `.next` de la sincronización.

### Verificaciones del hito storefront (anterior)

- `npm run typecheck`: OK.
- `npm run lint`: OK, sin warnings.
- `npm test`: 24 pruebas OK de preferencias, tenant, monto, moneda, ambiente, estados, idempotencia y webhook.
- `npm run test:integration`: 3 pruebas OK contra PostgreSQL local. Aprobaciones concurrentes, reembolso y notificación vieja; última unidad; último uso de cupón. Fixtures propios con limpieza al terminar.
- `npm run build`: OK, con las rutas públicas y de pagos.
- `npm run test:e2e`: 4 recorridos con Chromium y datos persistidos: navegación/búsqueda/filtros/zoom/políticas responsive; transferencia con cupón y envío; simulación y reintentos; CSRF, variantes ajenas, checkout simultáneo, efectivo y enlace WhatsApp con importes del servidor.
- Navegación manual asistida en navegador: `/s/alma`, `/s/nativa`, `/s/mia`, `/s/nido`, `/s/detalle` respondieron 200 con sus productos. Capturas de Alma en 1440 y 390 px inspeccionadas; pruebas también a 430 px. Capturas locales ignoradas en `test-results/manual/`.
- HTTP manual del hito anterior: webhook inválido 400, eventos ajenos 200, ID inválido 400, comercio sin credenciales 404; `/login` 200.
- Chrome abierto en `/s/alma`; servidor dev reiniciado para aplicar la configuración del pool.

## Fallos encontrados y correcciones / límites

- **Preexistente, PGlite:** consultas parametrizadas simultáneas cerraban conexiones (`P1017`, `ECONNRESET`). Reproducido con `pg` puro: ocho de diez consultas concurrentes fallaron, mientras consultas simples sin parámetros pasaban. Las consultas relacionadas de catálogo pasaron con pool de una conexión. Se configuró `DATABASE_POOL_MAX=1` y QA separada para evitar interferencia entre procesos. Para producción usar PostgreSQL convencional (Neon, Render u otro), no Prisma dev.
- **Preexistente, build con red restringida:** las cinco fuentes de `next/font/google` no se descargaban. El build real pasó con acceso de red; no se usaron fuentes simuladas.
- **Prisma y sandbox:** iniciar Prisma dev requiere escribir su directorio de datos fuera del workspace. Se ejecutó con escalación autorizada.
- **Pruebas de navegador:** primero se corrigió la carga ESM del cliente Prisma y un selector de prueba que confundía el alert de Next con el error de cupón. Después pasaron los recorridos.
- **`npm audit`: exit 1, cuatro entradas high preexistentes:** `deepmerge-ts@7.1.5` (GHSA-ggr8-5vv4-36mx), `mysql2@3.15.3` (GHSA-3f6p-5ww8-9rcr y GHSA-rgwj-5xj2-c3m3), y sus dependientes `@prisma/config` / `prisma`. Ambas versiones estaban en el lockfile antes de agregar Playwright. npm propone bajar Prisma a 6.19.3; no se aplicó un downgrade incompatible dentro de este hito. Revisar una actualización compatible en un hito de dependencias.
- Playwright/Next puede imprimir `The destination stream closed early` al abandonar una navegación con streaming; los recorridos terminaron correctamente, sin errores JS de página en la prueba de navegación. No se silenció el log.
- Rate limit sigue en memoria (una instancia).
- No se verificaron cobros reales, webhook público, dominio real, Safari/Firefox ni subida de imágenes.

## Pendientes

### P0

- ~~Arreglar e2e de filtros~~ y ~~landing comercial + `Lead` + reemplazo de `/`~~: hechos en esta sesión.
- Listado/gestión de leads en `/superadmin`.
- Panel `/admin` restante: productos/variantes, stock e historial, promociones, clientes, configuración. (Dashboard y pedidos: hechos.)
- `/demo`: selector de rubros, ver tienda y login demo al panel. No enviar usuarios a pantallas todavía inexistentes.
- Validación Mercado Pago SANDBOX con credenciales y HTTPS antes de ofrecer cobros reales.

### P1

- `/superadmin`: tiendas, alta (`provisionStore`), estado, dominios, plan, usuarios y soporte.
- SEO completo: canonical, OG, JSON-LD, robots y sitemap por tienda. Solo metadata básica de home y noindex de compra implementados.
- Tests unitarios dedicados para precios/WhatsApp; hoy están cubiertos parcialmente por recorridos y checkout con DB.

### P2 / P3

- Subida de imágenes validada (Cloudinary / local); reset demo desde superadmin.
- OAuth de Mercado Pago, emails, envíos por API, cuentas de cliente, rate limit distribuido.
- Firma de webhook con secreto configurable y conciliación administrativa; reembolsos parciales.

## Archivos de referencia

- `src/app/s/[slug]/*`, `src/components/store/*`
- `src/app/api/store/[slug]/orders/*`, `src/lib/services/{checkout,order-links,catalog}.ts`
- `src/lib/services/payments/mercadopago.ts`, webhook y sus pruebas
- `prisma/schema.prisma`, `prisma/migrations`, `prisma/seed.ts`
- `tests/integration/*`, `tests/e2e/storefront.spec.ts`, `playwright.config.ts`
- Admin: `src/app/admin/*`, `src/lib/services/admin/{common,types,orders,order-rules}.ts`, `src/components/admin/{labels,nav,order-badges,order-actions}.tsx`
- Landing: `docs/LANDING_BRIEF.md` (brief), `src/app/tienda-online/*`, `src/components/landing/*`, `src/lib/bmdev.ts`, `src/lib/services/{landing,leads/*}.ts`
- Helpers superadmin: `src/lib/services/superadmin/{constants,queries}.ts`

Referencias consultadas: [Mercado Pago Preferences API](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post), [Prisma conexiones](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections).
