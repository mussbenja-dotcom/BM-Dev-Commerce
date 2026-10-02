# Estado actual del proyecto — BM Dev Commerce Engine

- **Fecha:** 2026-10-01
- **Branch:** `main`
- **Último hito:** servicio Mercado Pago y webhook con pruebas unitarias y de integración (commit `feat: implement tenant-scoped Mercado Pago payments and webhook`).
- **Push:** realizado a `origin/main` (https://github.com/mussbenja-dotcom/BM-Dev-Commerce)

> Resumen honesto: la **base técnica está completa y verificada** (modelo multi-tienda, seed con 5 tiendas demo, auth, motor de precios, checkout server-side, login). **Todavía no hay pantallas de tienda, panel ni superadmin.** Lo siguiente es construir el storefront (`src/app/s/[slug]`).

---

## Qué se completó

| Módulo | Archivos | Estado |
|---|---|---|
| Scaffold Next.js 16.3 + TS + Tailwind 4 | `package.json`, `next.config.ts`, `tsconfig.json` | OK |
| Modelo de datos multi-tienda (Prisma 7, PostgreSQL) | `prisma/schema.prisma`, `prisma/migrations/20261002000400_init` | OK, migrado |
| Seed: superadmin y 5 tiendas demo (Alma Store/moda: 23 productos, 149 variantes y 46 pedidos; Nativa Skin; Mía Pastelería; Casa Nido; Detalle Regalos) | `prisma/seed.ts`, `prisma/seed-data/stores.ts`, `prisma/seed-data/images.json` (91 fotos de Unsplash verificadas a mano) | OK, ejecutado |
| Cliente Prisma (adapter pg) | `src/lib/db.ts` | OK |
| Sesiones propias: token aleatorio en cookie httpOnly y solo el sha256 en DB; roles; modo soporte | `src/lib/auth/session.ts`, `src/lib/auth/password.ts` (bcrypt 12) | OK |
| Login, logout, login demo con un clic (solo tiendas `isDemo` y si `DEMO_LOGIN_ENABLED=true`), rate limit | `src/lib/auth/actions.ts`, `src/app/login/*` | OK (`/login` responde 200) |
| Auditoría | `src/lib/audit.ts` | OK |
| Cifrado AES-256-GCM para tokens de Mercado Pago de cada tienda | `src/lib/crypto.ts` | OK |
| Rate limit en memoria y chequeo de Origin (CSRF) para route handlers | `src/lib/rate-limit.ts`, `src/lib/request.ts` | OK |
| Motor de precios puro: subtotal, cupón %/fijo/envío gratis, envío gratis por monto, descuento por transferencia, control de stock | `src/lib/pricing.ts` | OK (falta test unitario) |
| Checkout server-side: re-cotiza desde la DB, descuenta stock de forma atómica (`updateMany` con `stock >= qty`), cupón con límite de usos, numeración por tienda, cliente/dirección, eventos, movimientos de stock | `src/lib/services/checkout.ts` (`createOrder`, `buildQuote`, `checkoutSchema`, `ARGENTINE_PROVINCES`) | OK (falta conectarlo a una ruta API) |
| Catálogo: listado con filtros (q, categoría, talle, color, marca, precio, stock, oferta), orden, paginación, facets, home, relacionados, sugerencias de búsqueda | `src/lib/services/catalog.ts` | OK |
| Alta de tienda reutilizable (seed y superadmin) | `src/lib/services/provision.ts` (`newStoreSchema`, `provisionStore`) | OK |
| Plantillas: fashion, beauty, food, home, minimal (tokens de color, fuentes, radios y orden de secciones de la home) | `src/lib/templates.ts`, `src/components/store/theme.ts` (`themeStyle`) | OK |
| Mensaje de WhatsApp del pedido y link de consulta | `src/lib/whatsapp.ts` (`orderMessage`, `whatsappUrl`, `productInquiryMessage`) | OK |
| Resolución de tienda por dominio propio (`proxy.ts`), o por `/s/[slug]` en el dominio de la plataforma | `src/proxy.ts`, `src/lib/store/resolve.ts` | Escrito; sin probar con un dominio real |
| API pública de la tienda | `src/app/api/store/[slug]/quote/route.ts` (POST), `src/app/api/store/[slug]/search/route.ts` (GET) | Escrito |
| Carrito del cliente: localStorage por tienda, `useSyncExternalStore`, `useQuote` con debounce contra el servidor | `src/components/store/cart.tsx`, `src/components/store/store-context.tsx` | Escrito, falta la UI |
| Primitivas de UI | `src/components/ui/{button,field,badge,cn}.tsx` | OK |
| Tokens de diseño globales y fuentes | `src/app/globals.css`, `src/app/fonts.ts` | OK |
| Script dev para obtener una cookie de sesión | `scripts/dev-session.ts` | OK |

## Qué quedó parcialmente implementado

- **Mercado Pago:** servicio y webhook implementados. Preferencias con total del servidor, metadata de tienda, URLs propias y selección SANDBOX/PRODUCTION. Webhook vuelve a consultar el pago con el token de la tienda y valida ID, tienda, moneda ARS, ambiente y monto. `applyPaymentResult` bloquea la fila del pedido para serializar notificaciones; evita duplicados y regresiones de PAID/REFUNDED, y registra pagos tardíos sin reabrir pedidos cancelados. Sin credenciales reales no se verificó un cobro en Mercado Pago. El simulador `/pago/[token]`, confirmación y conexión al checkout aún están pendientes: **el flujo de compra no está terminado**.
- **Panel admin y superadmin:** dos agentes empezaron y se detuvieron por falta de tokens. Solo quedaron helpers sueltos:
  - `src/lib/services/admin/common.ts`, `src/lib/services/admin/types.ts`, `src/components/admin/labels.ts`
  - `src/lib/services/superadmin/constants.ts`, `src/lib/services/superadmin/queries.ts`
  - Revisarlos y reutilizarlos o reemplazarlos. **No existen rutas `/admin` ni `/superadmin`.**
- `src/app/page.tsx` todavía es la página por defecto de create-next-app.

## Qué falta hacer

### P0 — Crítico (demo comercial)
1. **Storefront** `src/app/s/[slug]/`:
   - `layout.tsx`: `getStoreBySlug`, `notFound()`, wrapper con `style={themeStyle(store.theme)}`, `StoreProvider` (base desde `getStoreBase`), `CartProvider`, barra de anuncio, header (logo, buscador con sugerencias de `/api/store/[slug]/search`, menú mobile, ícono de carrito con badge), footer (redes, políticas, "Desarrollado por BM Dev" → https://bmdev.solutions), botón flotante de WhatsApp y drawer del carrito.
   - `page.tsx` (home según `theme.homeSections`, con `getHomeData`), `productos/page.tsx` (catálogo con filtros: sheet en mobile, sidebar en desktop), `categorias/[category]/page.tsx`, `productos/[product]/page.tsx` (galería con zoom, variantes talle/color, stock, cuotas, agregar, comprar ahora, consultar por WhatsApp, relacionados), `checkout/page.tsx`, `pedido/[token]/page.tsx`, `pago/[token]/page.tsx` (simulador de pago demo), `politicas/[type]/page.tsx`, `not-found.tsx`.
   - Imágenes con `next/image` (ya está configurado `remotePatterns` para images.unsplash.com, y `qualities: [70, 80]`).
2. **Drawer del carrito**: cantidades, eliminar, cupón (`BIENVENIDA10`, `ALMA5000`, `ENVIOGRATIS`), estimador de envío por provincia, barra de progreso hacia el envío gratis, CTA a checkout y "Pedir por WhatsApp" (→ `checkout?via=whatsapp`).
3. **API de creación de pedido** `src/app/api/store/[slug]/orders/route.ts`: `isSameOrigin`, rate limit, `checkoutSchema`, `createOrder`. Según el medio de pago:
   - MP: `startMercadoPagoPayment`.
   - WHATSAPP: devolver la URL `wa.me` armada con `orderMessage`.
   - Transferencia o efectivo: ir a la confirmación, que muestra los datos bancarios.
   - `CheckoutError` → 400 con el mensaje.
4. **Mercado Pago**: recrear `startMercadoPagoPayment` (POST `https://api.mercadopago.com/checkout/preferences` con el token descifrado de la tienda, `external_reference=order.id`, `back_urls` a `/pedido/[token]`, `notification_url=${APP_URL}/api/webhooks/mercadopago/[storeId]`; sin token → modo DEMO, redirige a `/pago/[token]`), `syncMercadoPagoPayment` (el webhook vuelve a consultar `GET /v1/payments/{id}` con el token de la tienda, valida tienda y monto) y `applyPaymentResult` (idempotente; NEW→CONFIRMED al pagar; crea un OrderEvent).
5. **Panel del comercio** `/admin`: dashboard (ventas del día y del mes, pendientes, recientes, más vendidos, stock bajo), pedidos (lista, detalle, cambio de estado, cancelar con reposición de stock), productos (CRUD, duplicar, variantes, imágenes), stock (ajustes e historial), promociones (cupones, banners, destacados), clientes y configuración (negocio, apariencia, pagos, envíos, políticas). **Toda consulta debe filtrar por `session.storeId`** de `requireStoreSession()`.
6. **Página `/demo`** con "Ver tienda" y "Ver panel del negocio" (form → `demoLoginAction`, campo `slug`) y selector de rubro (alma, nativa, mia, nido, detalle).

### P1 — Importante
7. Superadmin `/superadmin`: lista de tiendas, alta (usa `newStoreSchema` + `provisionStore`), activar/suspender, dominios, plan, usuarios y modo soporte (`setSupportStore`).
8. Landing comercial `/tienda-online` (CTA "Quiero mi tienda" → WhatsApp con `BMDEV_WHATSAPP`, CTA "Ver demo", sin precios, "Solicitar presupuesto") y redirección de `/` a `/tienda-online`.
9. SEO por tienda: `generateMetadata`, canonical, OG, JSON-LD (Organization, Product, Breadcrumb), `s/[slug]/robots.txt` y `s/[slug]/sitemap.xml` como route handlers (`getStoreOrigin` ya existe).
10. Tests con vitest para `src/lib/pricing.ts` y `src/lib/whatsapp.ts`, más un test de aislamiento entre tiendas.

### P2 — Mejora
11. Subida de imágenes (`src/lib/storage.ts`: Cloudinary si están las env, si no `public/uploads`; validar magic bytes y 5 MB).
12. QA visual con Playwright en 390px, 430px y desktop.
13. Botón "Restablecer demo" en el superadmin (re-ejecuta la lógica del seed).

### P3 — Opcional
14. OAuth de Mercado Pago, emails transaccionales, cálculo de envío por API de correo, cuentas de cliente y un rate limit distribuido (Redis).

## Próximo paso exacto

1. Crear `src/app/s/[slug]/layout.tsx` y `src/app/s/[slug]/page.tsx` usando `getStoreBySlug`, `getHomeData`, `themeStyle`, `StoreProvider`, `CartProvider`. Probar en `http://localhost:3000/s/alma`.
2. Seguir con catálogo → producto → drawer → checkout → API de pedidos → confirmación y simulador demo. Conectar `startMercadoPagoPayment(storeId, orderId)` y proteger la simulación en el servidor. Después admin.
3. Probar Mercado Pago con credenciales SANDBOX y webhook público HTTPS antes de declarar lista la integración real.

## Arquitectura actual

- **Stack:** monolito modular con Next.js 16.3 (App Router; `proxy.ts` reemplaza a middleware y corre en Node), React 19, TypeScript, Tailwind 4, Prisma 7.10 (generator `prisma-client` en `src/generated/prisma`, adapter `@prisma/adapter-pg`), zod 4, bcryptjs y lucide-react.
- **Multi-tienda:** todos los modelos comerciales tienen `storeId` e índices compuestos. Rutas públicas: `/s/[slug]/...`. Con un dominio propio, `proxy.ts` busca el host en `StoreDomain` (caché de 60 s) y reescribe a `/s/[slug]`, marcando el header interno `x-bm-store-host`; el proxy borra ese header si viene del cliente. Para armar links: `getStoreBase(slug)` en el servidor y `useHref()` en el cliente.
- **Auth:** tabla `Session` (id = sha256 del token) y cookie `bm_session`. `requireStoreSession()` devuelve el `storeId` de la sesión (en modo soporte, el de la tienda soportada). Una tienda `SUSPENDED` bloquea a su staff. Roles: `SUPERADMIN_BMDEV`, `STORE_OWNER`, `STORE_ADMIN`.
- **Precios:** el frontend nunca envía precios. `buildQuote` y `createOrder` recalculan todo desde la DB.
- **Plantillas:** un solo storefront. `StoreTheme` → variables CSS (`--c-*`, `--f-*`, `--r`) → utilidades Tailwind (`bg-bg`, `text-fg`, `bg-primary`, `rounded-theme`, `font-heading`, etc.).
- **Mercado Pago:** una cuenta por comercio; el token se guarda cifrado en `StoreSettings.mpAccessTokenEnc` y `mpMode` puede ser DEMO, SANDBOX o PRODUCTION.

## Base de datos

- **Modelos:** Store, StoreDomain, StoreSettings, StoreTheme, User, Session, Category, Product, ProductVariant, ProductImage, StockMovement, Customer, Address, ShippingMethod, Coupon, Banner, Order, OrderItem, OrderEvent, Payment, AuditLog.
- **Migración aplicada:** `20261002000400_init`. No hay migraciones pendientes.
- **Seed:** `npm run db:seed`. Es idempotente: solo borra y recrea las tiendas con `isDemo=true`.
- **Local:** `npm run db:dev` levanta Prisma Postgres local (`prisma dev -n bmdev -d`) en `localhost:51214`.

## Variables de entorno (solo nombres; ver `.env.example`)

`DATABASE_URL`, `APP_URL`, `PLATFORM_HOSTS`, `ENCRYPTION_KEY`, `DEMO_LOGIN_ENABLED`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `DEMO_ADMIN_PASSWORD`, `BMDEV_WHATSAPP`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## Integraciones

| Integración | Estado |
|---|---|
| Mercado Pago | Servicio + webhook verificados localmente; faltan UI/checkout y prueba con credenciales reales |
| WhatsApp (wa.me) | MOCK/listo en lógica (`src/lib/whatsapp.ts`), falta la UI |
| Imágenes | FUNCIONANDO con URLs de Unsplash; subida PENDIENTE |
| Email | PENDIENTE |
| Dominio propio | Lógica escrita (`proxy.ts`), sin probar |

## Demo

- **Local:** `npm run db:dev`, luego `npm run dev`, y entrar a http://localhost:3000. `/login` funciona. `/s/alma` todavía no existe.
- **Usuario demo:** `demo@bmdev.solutions` (contraseña en `DEMO_ADMIN_PASSWORD` del `.env` local). **Superadmin:** `SUPERADMIN_EMAIL`.
- **Cupones de la demo:** `BIENVENIDA10`, `ALMA5000` (mínimo $60.000), `ENVIOGRATIS`.
- **Recorrido que funciona hoy:** solo el login. El resto está pendiente (ver P0).

## Problemas conocidos

- npm 11 bloquea scripts postinstall (`npm approve-scripts`). Por ahora no afecta.
- Algunas fotos de cosmética y regalería son aproximadas (protector solar, tónico, kit glow, llavero, banner 2 de detalle). Ver el detalle en el historial.
- El rate limit es en memoria: sirve para una sola instancia.
- `prisma dev` (PGlite) es solo para desarrollo; en producción usar Neon o el Postgres de Render.

## Tests realizados (hito de pagos, 2026-10-01)

- `npx tsc --noEmit` → OK
- `npx eslint src` → OK (0 errores)
- `npm run db:seed` → OK (5 tiendas)
- `GET /login` → 200
- `npm run typecheck` y `npm run lint` → OK.
- `npm test` → 24 pruebas OK (preferencias, aislamiento, validación, estados, errores, webhook).
- `npm run test:integration` → 1 prueba contra PostgreSQL local OK: cinco aprobaciones concurrentes producen un pago/evento; aislamiento, monto incorrecto, reembolso y notificación vieja. Crea una tienda temporal propia y la elimina al terminar; no modifica el seed.
- `npm run build` → OK. Primer intento restringido falló al descargar las cinco fuentes de Google Fonts ya presentes en `src/app/fonts.ts`; repetición con acceso de red pasó. No se ocultó ni se reemplazó por un build con fuentes simuladas.
- HTTP manual en servidor de producción local `:3100`: webhook JSON inválido → 400, tipo ajeno → 200, ID inválido → 400, tienda sin credenciales → 404; `/login` → 200. El puerto 3000 ya estaba ocupado; no se detuvo ese proceso.
- Prisma local necesitó permisos fuera del workspace para su directorio de datos; `npm run db:dev` pasó con escalación.
- No se probaron cobros reales, webhooks desde Internet ni UI de tienda (todavía ausente).

### Decisiones del hito de pagos

- Precios de la base y Mercado Pago en pesos enteros (no centavos).
- DEMO o token ausente solo permite simulación en tiendas `isDemo`; una tienda real sin configuración devuelve error para evitar pedidos ficticiamente pagados.
- El webhook usa el cuerpo solo para extraer el ID, nunca para acreditar un pago. El estado se obtiene de la API autenticada. No hay secreto de firma de webhook configurado aún.
- Reembolsos completos y contracargos se registran como REFUNDED; reembolsos parciales y conciliación administrativa quedan pendientes.
- Documentación consultada: https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post

## Archivos importantes

`prisma/schema.prisma`, `prisma/seed.ts`, `prisma/seed-data/*`, `src/proxy.ts`, `src/lib/services/{checkout,catalog,provision}.ts`, `src/lib/pricing.ts`, `src/lib/auth/*`, `src/lib/store/resolve.ts`, `src/lib/templates.ts`, `src/components/store/*`, `src/components/ui/*`, `AGENTS.md` (Next 16 trae su documentación en `node_modules/next/dist/docs/`).

## Git

- **Branch:** main
- **Push:** sí, a origin/main
- **Working tree:** limpio después del commit de este archivo
