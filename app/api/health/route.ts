import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getRenderQueue } from "@/lib/render-queue";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const queue = getRenderQueue();
  return NextResponse.json({
    ok: dbOk,
    db: dbOk ? "up" : "down",
    redis: queue ? "bullmq-configured" : "not-configured",
    ts: new Date().toISOString(),
  });
}
