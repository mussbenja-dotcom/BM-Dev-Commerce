# Estado actual — BM Dev Commerce Engine

- **Fecha:** 2026-10-01
- **Branch:** `main`
- **Hito anterior publicado:** `72976c0` — Mercado Pago y webhook.
- **Hito de este handoff:** storefront y checkout completos para el recorrido demo; commit `feat: complete storefront and checkout purchase flow`.
- **URL para revisar:** http://localhost:3000/s/alma (abierta en Chrome a pedido del usuario).

La tienda pública ya permite comprar de punta a punta: catálogo, producto, carrito, checkout, pedido y simulador de pago. **No están terminados el panel del comercio, superadmin, landing ni cobros reales con Mercado Pago.**

## Próximo paso exacto

1. Implementar el primer recorrido completo de `/admin`: dashboard → listado de pedidos → detalle → cambios de estado y cancelación con reposición de stock. Usar `requireStoreSession()` y filtrar siempre por `session.storeId`. Revisar los helpers existentes de `src/lib/services/admin`.
2. Probar con dos tiendas que ningún listado, detalle o mutación pueda acceder a la otra. Una cancelación repetida debe reponer stock una sola vez. Decidir explícitamente cómo manejar pedidos pagados: cambiar el estado local no equivale a hacer un reembolso en Mercado Pago.
3. Al cerrar el hito: typecheck, lint, tests, build, navegador, actualizar este archivo, commit y push.
4. Continuar con productos/variantes/stock, promociones, clientes y configuración. Luego `/demo`, superadmin y landing. Priorizar recorridos completos.

## Hitos implementados

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

Antes de publicar en otro entorno: `npm run db:deploy`.

- Demo local: Prisma dev `bmdev`, PostgreSQL en `localhost:51214`.
- QA local: Prisma dev `bmdev-qa`, PostgreSQL en `localhost:51218`. La CLI imprimió 51218 aunque se solicitaron otros puertos; usar siempre la URL efectiva.
- `.env` local contiene `DATABASE_POOL_MAX=1` y `E2E_DATABASE_URL` de QA. No se commitean secretos.
- `npm run db:seed` recrea solo tiendas `isDemo`; no ejecutarlo para probar cambios sobre datos que se quieran conservar.
- Seed verificado en QA: Alma 23 productos / 149 variantes, Nativa 10 / 11, Mía 10 / 13, Nido 9 / 13, Detalle 8 / 8.

## Verificaciones del hito

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

- Panel `/admin`: dashboard, pedidos, productos/variantes, stock e historial, promociones, clientes, configuración.
- `/demo`: selector de rubros, ver tienda y login demo al panel. No enviar usuarios a pantallas todavía inexistentes.
- Validación Mercado Pago SANDBOX con credenciales y HTTPS antes de ofrecer cobros reales.

### P1

- `/superadmin`: tiendas, alta (`provisionStore`), estado, dominios, plan, usuarios y soporte.
- Landing `/tienda-online` y reemplazo/redirección de `/`, que sigue siendo create-next-app.
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
- Helpers admin existentes: `src/lib/services/admin/{common,types}.ts`, `src/components/admin/labels.ts`
- Helpers superadmin: `src/lib/services/superadmin/{constants,queries}.ts`

Referencias consultadas: [Mercado Pago Preferences API](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post), [Prisma conexiones](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections).
