# Brief — Página comercial BM Dev E-commerce

Pedido del usuario (2026-10-01). Es la fuente de verdad para construir la landing (`/tienda-online` y la raíz `/`).

## Qué es y qué NO es

- **Única meta:** conseguir clientes que soliciten una **tienda online personalizada**.
- **NO** es una tienda de BM Dev: sin catálogo, carrito, checkout, productos ni categorías propias.
- En menos de 10 segundos se debe entender: qué ofrecemos, para quién, qué puede hacer la tienda, que se puede ver funcionando y cómo pedir una.
- Hablar de beneficios para el comercio. **No mencionar** Next.js, Prisma, PostgreSQL, APIs.
- **Sin precios fijos.** Usar "Solicitar presupuesto" / "Contanos qué necesitás" (cada caso varía: cantidad de productos, integraciones, diseño, dominio, migración, funciones especiales).

## Separación de piezas (no mezclar)

| Pieza | Qué es |
|---|---|
| BM Dev E-commerce | Página comercial para solicitar una tienda |
| Storefront `/s/[slug]` | La tienda que recibe cada cliente |
| Admin `/admin` | Panel de cada comercio |
| Superadmin `/superadmin` | Panel interno de BM Dev |
| Demo | Tienda ficticia funcional para vender el servicio |

## Mensajes

- Titular (idea, se puede mejorar): **"Tu tienda online, hecha para tu negocio."**
- Subtítulo (idea): "Creamos tiendas online personalizadas para emprendimientos y comercios. Tu marca, tu dominio, tus productos y tu propia administración."
- Idea central: **"No te damos una tienda genérica. La adaptamos a tu negocio."**
- Aclarar: **BM Dev no cobra comisión porcentual por venta.** Los costos de procesamiento son del proveedor elegido (p. ej. Mercado Pago).
- CTA principal: **"Quiero mi tienda online"**. Secundarios: "Solicitar presupuesto", "Contanos tu idea", "Ver demo", "Quiero una tienda para mi negocio".

## Qué incluye (listar con beneficios)

Diseño personalizado, dominio propio, logo y colores de la marca, catálogo, categorías, carrito, checkout, Mercado Pago, transferencia, WhatsApp, gestión de pedidos, control de stock, cupones y promociones, panel administrativo, responsive / optimizado para celular, soporte de BM Dev.

## Rubros de ejemplo

Moda, Calzado, Cosmética, Pastelería, Regalería, Decoración, Alimentos, Comercio general. Usar las demos multi-rubro (alma, nativa, mia, nido, detalle) para mostrar cómo cambia la misma plataforma.

## Estructura sugerida

1. **Hero** — titular + "Quiero mi tienda" + "Ver demo".
2. **Ejemplos visuales** de distintos tipos de tienda.
3. **Qué incluye** — catálogo, carrito, pagos, WhatsApp, pedidos, stock, promociones, panel.
4. **Personalización** — logo, colores, dominio, productos, diseño.
5. **Cómo funciona** — 1) Nos contás sobre tu negocio 2) Personalizamos tu tienda 3) Configuramos productos, pagos y dominio 4) La publicamos.
6. **Demo** — "Conocé cómo podría verse tu tienda" + "Ver demo". Previews desktop, celular y panel admin: cómo compra el cliente y cómo administra el comercio.
7. **Diferenciales** — desarrollo personalizado, sin comisión de BM Dev por venta, soporte, adaptado al negocio, mobile-first, administración sencilla.
8. **Solicitud** — formulario.
9. **CTA final** — "Empezá a vender con tu propia tienda online." Botón "Solicitar mi tienda".

## Formulario (corto)

Campos: Nombre, Nombre del negocio, WhatsApp, Email, Instagram, Rubro, ¿Actualmente vendés online?, Cantidad aproximada de productos, ¿Qué necesitás?
Opcionales: ¿Ya tenés dominio?, ¿Usás Mercado Pago?, Comentario adicional.
Objetivo: generar el lead (guardar en DB, validar en servidor, rate limit, honeypot).

## WhatsApp

CTA directo "Quiero mi tienda" que abra WhatsApp de BM Dev con:

```
Hola, estuve viendo BM Dev E-commerce y me interesa tener una tienda online para mi negocio.

Mi negocio se llama:
Rubro:
Instagram:

Quisiera recibir más información.
```

Número desde `BMDEV_WHATSAPP` (env), leído en **un solo helper**; no hardcodear en componentes.

## Identidad

Usar fuertemente la identidad de BM Dev, coherente con https://bmdev.solutions (revisarla antes de diseñar), sin duplicar su landing: esta está 100 % orientada a **tiendas online personalizadas**. Diseñar primero para conversión.
