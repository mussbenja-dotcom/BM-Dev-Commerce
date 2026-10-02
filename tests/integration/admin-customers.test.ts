import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { db } from "@/lib/db";
import { exportCustomers, getCustomer, listCustomers } from "@/lib/services/admin/customers";

const stores: string[] = [];

async function store(label: string) {
  const s = await db.store.create({ data: { slug: `qa-customers-${label}-${randomUUID()}`, name: label, industry: "test", template: "minimal", status: "ACTIVE", settings: { create: {} } } });
  stores.push(s.id);
  return s.id;
}

afterAll(async () => {
  await db.store.deleteMany({ where: { id: { in: stores } } });
});

describe("admin customers", () => {
  it("lists, searches and sorts only the store's customers", async () => {
    const [a, b] = [await store("a"), await store("b")];
    await db.customer.createMany({
      data: [
        { storeId: a, email: "ana@example.invalid", firstName: "Ana", lastName: "Gómez", phone: "1155550001", ordersCount: 1, totalSpent: 5000 },
        { storeId: a, email: "beto@example.invalid", firstName: "Beto", lastName: "Paz", ordersCount: 3, totalSpent: 90000 },
        { storeId: b, email: "ana@example.invalid", firstName: "Ana", lastName: "Ajena", ordersCount: 9, totalSpent: 999999 },
      ],
    });
    const all = await listCustomers(a, { sort: "compras", page: 1 });
    expect(all.rows.map((c) => c.firstName)).toEqual(["Beto", "Ana"]);
    expect(all.storeTotals).toEqual({ customers: 2, spent: 95000 });
    expect((await listCustomers(a, { q: "ana", sort: "recientes", page: 1 })).rows.map((c) => c.lastName)).toEqual(["Gómez"]);
    expect((await listCustomers(a, { q: "5550001", sort: "recientes", page: 1 })).total).toBe(1);
    expect((await exportCustomers(a)).map((c) => c.lastName).sort()).toEqual(["Gómez", "Paz"]);

    const foreign = await db.customer.findFirstOrThrow({ where: { storeId: b } });
    expect(await getCustomer(a, foreign.id)).toBeNull();
    const own = await db.customer.findFirstOrThrow({ where: { storeId: a, firstName: "Ana" } });
    expect(await getCustomer(a, own.id)).toMatchObject({ lastName: "Gómez", orders: [], addresses: [] });
  });
});
