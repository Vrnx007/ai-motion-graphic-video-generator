import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const rawUrl =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

function stripSslModeFromUrl(url: string): string {
  return url
    .replace(/[?&]sslmode=[^&]*/g, (match) => (match.startsWith("?") ? "?" : ""))
    .replace(/\?$/, "");
}

/** Read sslmode from connection URL (libpq / Neon / Supabase variants). */
function sslModeFromUrl(url: string): string {
  try {
    return (new URL(url).searchParams.get("sslmode") || "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * TLS for `pg` Pool. Prisma adapter does not use libpq; we must mirror sslmode here.
 *
 * Default is **not** to verify the server certificate chain (`rejectUnauthorized: false`).
 * Many hosted Postgres URLs (and some proxies) trigger Node’s
 * “self signed certificate in certificate chain” even though traffic is still TLS.
 *
 * Opt in to strict verification: set `DATABASE_SSL_REJECT_UNAUTHORIZED=true`, or
 * supply `DATABASE_SSL_CA` (PEM path) which implies verify with that CA bundle.
 * URL `sslmode=no-verify` also disables verification; `sslmode=disable` turns SSL off.
 */
function getPoolSsl(
  url: string
): undefined | false | { rejectUnauthorized: boolean; ca?: string } {
  if (!url.trim()) return undefined;

  const mode = sslModeFromUrl(url);
  if (mode === "disable") return false;

  const envRaw = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  const envSet = envRaw !== undefined && String(envRaw).trim() !== "";
  const envVerify = String(envRaw ?? "true").toLowerCase() !== "false";

  const caPath = process.env.DATABASE_SSL_CA?.trim();
  let ca: string | undefined;
  if (caPath) {
    try {
      ca = readFileSync(caPath, "utf8");
    } catch {
      // Missing file: ignore; connection may still work without custom CA
    }
  }

  if (envSet) {
    return { rejectUnauthorized: envVerify, ...(ca ? { ca } : {}) };
  }

  if (mode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  // Custom CA without explicit env → verify using supplied roots only
  if (ca) {
    return { rejectUnauthorized: true, ca };
  }

  return { rejectUnauthorized: false };
}

const connectionString = stripSslModeFromUrl(rawUrl);
const ssl = getPoolSsl(rawUrl);

const pool = new Pool({
  connectionString,
  ssl: connectionString ? ssl : undefined,
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
