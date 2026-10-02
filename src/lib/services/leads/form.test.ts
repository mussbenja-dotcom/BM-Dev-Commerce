import { describe, expect, it } from "vitest";
import { bmdevInterestMessage, normalizeInstagram, parseLeadForm } from "./form";

const valid = {
  name: "Ana Pérez",
  businessName: "Dulce Ana",
  whatsapp: "+54 9 11 2345-6789",
  email: " Ana@Example.com ",
  instagram: "https://www.instagram.com/Dulce.Ana/",
  industry: "Pastelería",
  sellsOnline: "redes",
  productCount: "21-100",
  needs: "nueva",
  hasDomain: "no",
  comment: "  ",
};
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("parseLeadForm", () => {
  it("normalizes a valid submission", () => {
    const result = parseLeadForm(form(valid));
    expect(result).toEqual({
      ok: true,
      data: {
        name: "Ana Pérez", businessName: "Dulce Ana", whatsapp: "5491123456789", email: "ana@example.com",
        instagram: "dulce.ana", industry: "Pastelería", sellsOnline: "redes", productCount: "21-100", needs: "nueva",
        hasDomain: false, usesMercadoPago: null, comment: null,
      },
    });
  });

  it("reports one Spanish message per invalid field and keeps the typed values", () => {
    const result = parseLeadForm(form({ ...valid, name: "", whatsapp: "123", email: "nope", industry: "Hackeo", sellsOnline: "__proto__", instagram: "no válido!" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(["email", "industry", "instagram", "name", "sellsOnline", "whatsapp"]);
    expect(result.fieldErrors.whatsapp).toBe("Ingresá un WhatsApp con código de área.");
    expect(result.values.businessName).toBe("Dulce Ana");
  });

  it("requires the short-form fields when they are missing", () => {
    const result = parseLeadForm(new FormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors).sort()).toEqual(["businessName", "email", "industry", "name", "needs", "productCount", "sellsOnline", "whatsapp"]);
  });

  it("rejects unknown yes/no answers and overlong comments", () => {
    const result = parseLeadForm(form({ ...valid, usesMercadoPago: "quizas", comment: "x".repeat(1001) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors).sort()).toEqual(["comment", "usesMercadoPago"]);
  });
});

describe("normalizeInstagram", () => {
  it.each([["@mi.tienda", "mi.tienda"], ["instagram.com/Mi_Tienda?igsh=1", "mi_tienda"], ["", ""]])("%s -> %s", (raw, out) => {
    expect(normalizeInstagram(raw)).toBe(out);
  });
});

describe("bmdevInterestMessage", () => {
  it("matches the brief when nothing is known yet", () => {
    expect(bmdevInterestMessage()).toBe(
      "Hola, estuve viendo BM Dev E-commerce y me interesa tener una tienda online para mi negocio.\n\nMi negocio se llama:\nRubro:\nInstagram:\n\nQuisiera recibir más información.",
    );
  });
  it("fills in the visitor's details", () => {
    expect(bmdevInterestMessage({ businessName: "Dulce Ana", industry: "Pastelería", instagram: "dulce.ana" })).toContain(
      "Mi negocio se llama: Dulce Ana\nRubro: Pastelería\nInstagram: @dulce.ana",
    );
  });
});
