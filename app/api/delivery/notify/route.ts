import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/** SES/Postmark bridge — stub logs payload. */
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  logger.info({ body }, "delivery.notify stub");
  return NextResponse.json({ ok: true, mode: "stub" });
}
