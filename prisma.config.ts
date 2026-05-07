import { defineConfig } from "@prisma/config";
import * as dotenv from "dotenv";

dotenv.config();

// Aggressively find any postgres connection string in the environment
const getDbUrl = () => {
  const envVars = [
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL",
    "DATABASE_URL_UNPOOLED",
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DATABASE_URL",
    "SUPABASE_URL",
    "DB_URL"
  ];
  
  for (const key of envVars) {
    if (process.env[key] && typeof process.env[key] === "string" && process.env[key].startsWith("postgres")) {
      console.log(`[Prisma Config] Found database URL in environment variable: ${key}`);
      return process.env[key];
    }
  }
  
  // If we can't find one by known names, search all env vars
  for (const key in process.env) {
    const val = process.env[key];
    if (val && typeof val === "string" && val.startsWith("postgres://")) {
      console.log(`[Prisma Config] Found fallback database URL in: ${key}`);
      return val;
    }
  }
  
  console.log("[Prisma Config] WARNING: No PostgreSQL connection string found in environment variables.");
  return process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost/dummy";
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: getDbUrl(),
  },
  migrations: {
    path: "prisma/migrations",
  },
});