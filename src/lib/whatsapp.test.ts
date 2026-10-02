import { describe, expect, it } from "vitest";
import { normalizeWhatsapp, orderMessage, productInquiryMessage, whatsappUrl } from "./whatsapp";

describe("whatsapp", () => {
  it("normalizes numbers and builds wa.me links", () => {
    expect(normalizeWhatsapp("+54 9 11 5555-0123")).toBe("5491155550123");
    expect(normalizeWhatsapp("123")).toBeNull();
    expect(normalizeWhatsapp(null)).toBeNull();
    expect(whatsappUrl("54 9 11 5555 0123", "Hola & chau")).toBe("https://wa.me/5491155550123?text=Hola%20%26%20chau");
    expect(whatsappUrl("", "x")).toBeNull();
  });

  it("asks about a product with its variant and link", () => {
    expect(productInquiryMessage({ name: "Remera", variant: "M / Negro", url: "https://alma.com.ar/productos/remera" })).toBe(
      "Hola! Quería consultar por Remera (M / Negro).\nhttps://alma.com.ar/productos/remera",
    );
  });

  it("builds the order message from saved totals", () => {
    const msg = orderMessage({
      storeName: "Alma", orderNumber: 1049,
      lines: [{ name: "Buzo", variant: "L / Verde", quantity: 2, unitPrice: 10000 }],
      subtotal: 20000, couponCode: "BIENVENIDA10", discount: 2000, shipping: 0, total: 18000,
      customerName: "Ana Pérez", delivery: "SHIPPING", shippingMethodName: "Moto", address: "Gorriti 4870, CABA",
      paymentLabel: "A coordinar por WhatsApp", notes: "Timbre 2",
    });
    expect(msg.split("\n")[0]).toBe("Hola Alma! Quiero realizar este pedido (#1049):");
    for (const line of ["Producto: Buzo", "Variante: L / Verde", "Cantidad: 2", "Descuento (BIENVENIDA10): -", "Envío: Gratis", "Dirección: Gorriti 4870, CABA", "Forma de entrega: Envío a domicilio (Moto)", "Pago: A coordinar por WhatsApp", "Notas: Timbre 2"]) {
      expect(msg).toContain(line);
    }
    expect(msg).toMatch(/Total: \$\s?18\.000/);
  });

  it("describes pickup without an address", () => {
    const msg = orderMessage({ storeName: "Mía", lines: [], subtotal: 0, discount: 0, shipping: 0, total: 0, customerName: "Leo", delivery: "PICKUP", address: "No debe salir" });
    expect(msg).toContain("Envío: Retiro en el local");
    expect(msg).not.toContain("No debe salir");
    expect(msg.split("\n")[0]).toBe("Hola Mía! Quiero realizar este pedido:");
  });
});
