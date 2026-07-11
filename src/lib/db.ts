import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

/**
 * Prefer session pooler (DIRECT_URL) locally — transaction pooler + Prisma
 * prepared statements is flaky, and a stale Next process can keep a bad host.
 * On Vercel / production, use DATABASE_URL (transaction pooler).
 */
function resolveConnectionString(): string {
  const isProd =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const url =
    (!isProd && process.env.DIRECT_URL?.trim()) ||
    process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      isProd
        ? "DATABASE_URL is not set"
        : "DIRECT_URL or DATABASE_URL is not set",
    );
  }
  return url;
}

function createClient() {
  const connectionString = resolveConnectionString();
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      // Supabase pooler presents a cert that Node may not trust by default.
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  globalForPrisma.pgPool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/** Lazily connects so `next build` can import routes without DATABASE_URL. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
