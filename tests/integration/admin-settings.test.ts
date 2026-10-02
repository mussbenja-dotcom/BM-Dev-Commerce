import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import type { Actor } from "@/lib/services/admin/orders";
import { getStoreSettings, saveShippingMethod, updateContact, updatePayments, updateStoreInfo, type PaymentsInput } from "@/lib/services/admin/settings";
import { getShippingMethods } from "@/lib/services/checkout";

const stores: string[] = [];

async function actor(label: string, opts: { isDemo?: boolean; token?: boolean } = {}): Promise<Actor> {
  const store = await db.store.create({
    data: {
      slug: `qa-settings-${label}-${randomUUID()}`, name: `Config ${label}`, industry: "test", template: "minimal", status: "ACTIVE", isDemo: opts.isDemo ?? false,
      settings: { create: { mpMode: opts.token ? "PRODUCTION" : "DEMO", mpAccessTokenEnc: opts.token ? "cifrado-de-prueba" : null } },
    },
  });
  stores.push(store.id);
  return { storeId: store.id, userId: "qa" };
}

const payments = (extra: Partial<PaymentsInput> = {}): PaymentsInput => ({
  enableMercadoPago: false, enableTransfer: true, enableCash: false, enableWhatsappOrder: false, transferDiscountPct: 10, maxInstallments: 3,
  bankName: null, bankHolder: "Titular QA", bankCbu: "2850590900000940401231", bankAlias: null, bankCuit: null, ...extra,
});

afterAll(async () => {
  await db.store.deleteMany({ where: { id: { in: stores } } });
});

describe("admin settings", () => {
  it("never exposes the Mercado Pago token and reports its availability", async () => {
    const real = await actor("real", { token: true });
    const data = await getStoreSettings(real.storeId);
    expect(data.settings).not.toHaveProperty("mpAccessTokenEnc");
    expect(JSON.stringify(data)).not.toContain("cifrado-de-prueba");
    expect(data.mercadoPago).toEqual({ mode: "PRODUCTION", hasToken: true, available: true });
  });

  it("requires a payment method customers can actually use", async () => {
    const plain = await actor("plain");
    await expect(updatePayments(plain, payments({ enableTransfer: false, enableMercadoPago: true }))).rejects.toMatchObject({ fieldErrors: { enableTransfer: expect.any(String) } });
    await expect(updatePayments(plain, payments({ bankCbu: "123" }))).rejects.toMatchObject({ fieldErrors: { bankCbu: expect.any(String) } });
    await updatePayments(plain, payments());
    expect(await db.storeSettings.findUniqueOrThrow({ where: { storeId: plain.storeId } })).toMatchObject({ enableTransfer: true, transferDiscountPct: 10, bankCbu: "2850590900000940401231" });
    const demo = await actor("demo", { isDemo: true });
    await expect(updatePayments(demo, payments({ enableTransfer: false, enableMercadoPago: true }))).resolves.toEqual({ mercadoPagoAvailable: true, bankLocked: false });
  });

  it("keeps bank details unchanged for demo sessions", async () => {
    const demo = await actor("demo-bank", { isDemo: true });
    await db.storeSettings.update({ where: { storeId: demo.storeId }, data: { bankHolder: "Demo S.R.L.", bankAlias: "demo.alias" } });
    const r = await updatePayments({ ...demo, isDemo: true }, payments({ bankHolder: "Estafador", bankAlias: "robo.alias", bankCbu: null, transferDiscountPct: 15 }));
    expect(r.bankLocked).toBe(true);
    expect(await db.storeSettings.findUniqueOrThrow({ where: { storeId: demo.storeId } })).toMatchObject({ bankHolder: "Demo S.R.L.", bankAlias: "demo.alias", transferDiscountPct: 15 });
  });

  it("writes only the session store's settings and shipping methods", async () => {
    const [a, b] = [await actor("a"), await actor("b")];
    await updateStoreInfo(a, { name: "Nueva A", tagline: "Hola", description: null, announcement: null, footerText: null, logoUrl: null, faviconUrl: null, seoTitle: null, seoDescription: null });
    await updateContact(a, { whatsapp: "5491155550000", email: "a@example.invalid", phone: null, instagram: "tienda.a", facebook: null, tiktok: null, address: null, city: null, province: "Córdoba", hours: null });
    await expect(updateContact(a, { whatsapp: null, email: null, phone: null, instagram: null, facebook: null, tiktok: null, address: null, city: null, province: "Narnia", hours: null })).rejects.toThrow("Elegí una provincia de la lista.");
    expect((await db.store.findUniqueOrThrow({ where: { id: b.storeId } })).name).toBe("Config b");
    expect((await db.storeSettings.findUniqueOrThrow({ where: { storeId: b.storeId } })).whatsapp).toBeNull();

    const ship = await saveShippingMethod(a, null, { name: "Envío QA", description: null, type: "SHIPPING", price: 3000, provinces: ["CABA"], estimatedDays: null, active: true, position: 0 });
    const pickup = await saveShippingMethod(a, null, { name: "Retiro", description: null, type: "PICKUP", price: 0, provinces: ["CABA"], estimatedDays: null, active: true, position: 1 });
    expect((await db.shippingMethod.findUniqueOrThrow({ where: { id: pickup.id } })).provinces).toEqual([]);
    await expect(saveShippingMethod(b, ship.id, { name: "Robado", description: null, type: "SHIPPING", price: 0, provinces: [], estimatedDays: null, active: true, position: 0 })).rejects.toThrow("No encontramos la forma de entrega.");
    await expect(saveShippingMethod(a, null, { name: "X", description: null, type: "SHIPPING", price: 0, provinces: ["Narnia"], estimatedDays: null, active: true, position: 0 })).rejects.toThrow("Elegí provincias de la lista.");

    await saveShippingMethod(a, ship.id, { name: "Envío QA", description: null, type: "SHIPPING", price: 3000, provinces: ["CABA"], estimatedDays: null, active: false, position: 0 });
    expect((await getShippingMethods(a.storeId)).map((m) => m.name)).toEqual(["Retiro"]);
    expect(await getShippingMethods(b.storeId)).toEqual([]);
  });
});
