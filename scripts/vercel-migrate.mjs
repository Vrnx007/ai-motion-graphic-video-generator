/**
 * Vercel / CI: `prisma migrate deploy` fails with P3005 when the database already
 * has tables but no `_prisma_migrations` history (e.g. schema was created with `db push`).
 * This script applies each migration SQL file under prisma/migrations via `db execute`, then
 * `migrate resolve --applied`, then runs `migrate deploy` again (no-op or picks up new migrations).
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function prisma(args, inherit) {
  return spawnSync("npx", ["prisma", ...args], {
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    env: process.env,
  });
}

const first = prisma(["migrate", "deploy"], false);
const combined = `${first.stdout || ""}\n${first.stderr || ""}`;
if (first.stdout) process.stdout.write(first.stdout);
if (first.stderr) process.stderr.write(first.stderr);

if (first.status === 0) {
  process.exit(0);
}

if (!combined.includes("P3005")) {
  process.exit(first.status ?? 1);
}

const migrationsDir = join(process.cwd(), "prisma", "migrations");
const names = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

for (const name of names) {
  const file = join(migrationsDir, name, "migration.sql");
  if (!existsSync(file)) continue;
  console.error(`[migrate] P3005 baseline: db execute ${name}/migration.sql`);
  const r = prisma(["db", "execute", "--file", file], true);
  if (r.status !== 0) process.exit(r.status ?? 1);
}

for (const name of names) {
  const file = join(migrationsDir, name, "migration.sql");
  if (!existsSync(file)) continue;
  console.error(`[migrate] P3005 baseline: migrate resolve --applied ${name}`);
  const r = prisma(["migrate", "resolve", "--applied", name], true);
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.error("[migrate] P3005 baseline: migrate deploy (finalize)");
const last = prisma(["migrate", "deploy"], true);
process.exit(last.status ?? 0);
