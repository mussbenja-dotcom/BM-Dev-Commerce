/**
 * Seeds the BM Dev superadmin and the five demo stores.
 * Idempotent: demo stores (isDemo = true) are dropped and recreated.
 * Real (non-demo) stores are never touched.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SEED_STORES } from "./seed-data/stores";
import { seedDemoStore } from "./seed-data/demo";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: Number(process.env.DATABASE_POOL_MAX ?? 10) }) });

async function seedSuperadmin() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("! SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set — skipping superadmin.");
    return;
  }
  await db.user.upsert({
    where: { email },
    create: { email, name: "BM Dev", role: "SUPERADMIN_BMDEV", passwordHash: await bcrypt.hash(password, 12) },
    update: {},
  });
  console.log(`✓ superadmin ${email}`);
}

async function main() {
  await seedSuperadmin();
  const demoPassword = process.env.DEMO_ADMIN_PASSWORD;
  if (!demoPassword) throw new Error("DEMO_ADMIN_PASSWORD must be set to seed demo stores.");
  const hash = await bcrypt.hash(demoPassword, 12);
  for (const s of SEED_STORES) await seedDemoStore(db, s, hash);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
