# BM Dev Commerce

Monolito multi-tienda con Next.js 16.3, React 19, Prisma 7 y PostgreSQL. El estado detallado y el próximo hito están en [HANDOFF.md](HANDOFF.md).

## Desarrollo local

1. Instalar dependencias con `npm ci`.
2. Copiar `.env.example` a `.env` y completar las variables.
3. Iniciar PostgreSQL local con `npm run db:dev` y usar la URL que imprime Prisma en `DATABASE_URL`.
4. Para Prisma dev / PGlite, usar `DATABASE_POOL_MAX=1` (su protocolo falla con consultas parametrizadas simultáneas). En PostgreSQL convencional, ajustar el pool según el presupuesto de conexiones; el valor por defecto del código es 10.
5. Ejecutar `npm run db:deploy` y, para cargar las tiendas de ejemplo, `npm run db:seed`.
6. Iniciar `npm run dev` y abrir http://localhost:3000/s/alma.

El seed recrea las tiendas demo. Las otras demos están en `/s/nativa`, `/s/mia`, `/s/nido` y `/s/detalle`.

## Verificaciones

```bash
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npm run test:e2e
```

El build descarga las fuentes de Google Fonts, por lo que necesita acceso a Internet. `test:e2e` usa el build de producción y levanta Next en el puerto 3100; Chromium debe estar instalado (`npx playwright install chromium`).

Para pruebas de base de datos y navegador, configurar `E2E_DATABASE_URL` con una base QA separada y aplicar allí `npm run db:deploy` usando esa URL como `DATABASE_URL`. Se puede crear otra instancia local con `npx prisma dev --name bmdev-qa --detach`; utilizar la URL que realmente imprime el comando. Esto evita que dos procesos compitan por la instancia PGlite que sirve la demo. Los fixtures crean tiendas con nombres aleatorios y eliminan únicamente esas tiendas al terminar; no necesitan el seed.

## Recorrido disponible

Home → catálogo y filtros → producto y variantes → carrito → checkout → pedido. Transferencia muestra datos bancarios; efectivo queda pendiente; WhatsApp genera un enlace con el pedido guardado. El simulador de Mercado Pago solo acredita pedidos de tiendas demo. Las notificaciones reales se verifican consultando la API del proveedor con las credenciales del comercio.

La integración de cobros reales todavía necesita una prueba con credenciales SANDBOX y un webhook HTTPS público. Panel admin, superadmin, selector de demos y landing comercial siguen pendientes.
