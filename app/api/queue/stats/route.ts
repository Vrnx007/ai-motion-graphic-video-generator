import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getRenderQueue } from "@/lib/render-queue";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = getRenderQueue();
  if (!q) {
    return NextResponse.json({ queue: "disabled", waiting: 0, active: 0 });
  }
  const counts = await q.getJobCounts("wait", "active", "delayed");
  return NextResponse.json({
    queue: "motion-render",
    waiting: counts.wait ?? 0,
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
  });
}
