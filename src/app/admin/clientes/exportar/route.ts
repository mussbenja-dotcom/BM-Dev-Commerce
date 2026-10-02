import { requireStoreSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { exportCustomers } from "@/lib/services/admin/customers";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await requireStoreSession();
  const rows = await exportCustomers(session.storeId);
  await audit({ action: "customers.export", storeId: session.storeId, userId: session.userId, meta: { count: rows.length } });
  const csv = toCsv(
    ["Nombre", "Apellido", "Email", "Teléfono", "Pedidos", "Total comprado", "Cliente desde"],
    rows.map((c) => [c.firstName, c.lastName, c.email, c.phone, c.ordersCount, c.totalSpent, c.createdAt.toISOString().slice(0, 10)]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
