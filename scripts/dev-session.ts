/**
 * DEV ONLY. Prints a session cookie for an existing user so pages behind
 * auth can be tested with curl:  npx tsx scripts/dev-session.ts demo@bmdev.solutions
 * then: curl -H "Cookie: bm_session=<token>" http://localhost:3000/admin
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production") throw new Error("dev-session is disabled in production");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("usage: tsx scripts/dev-session.ts <email>");
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { id: createHash("sha256").update(token).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 864e5) },
  });
  console.log(token);
}
main().finally(() => db.$disconnect());
