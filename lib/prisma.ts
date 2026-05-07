import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// Force Node.js to accept self-signed certs (required for Supabase)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const rawUrl =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  '';

// Strip any ?sslmode= param from the URL so our Pool ssl option takes full control
const connectionString = rawUrl.replace(/[?&]sslmode=[^&]*/g, (match) => {
  const prefix = match.startsWith('?') ? '?' : '';
  return prefix;
}).replace(/\?$/, '');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
