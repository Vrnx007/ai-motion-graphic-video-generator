import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

/**
 * Owner: GET ?id=... with session — project must belong to user.
 * Public share: GET ?shareToken=... — no session; returns same payload for preview player.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const shareToken = searchParams.get("shareToken");

  if (!id && !shareToken) {
    return NextResponse.json({ error: "id or shareToken is required" }, { status: 400 });
  }

  try {
    if (shareToken) {
      const token = shareToken.trim();
      if (!token || token.length > 128) {
        return NextResponse.json({ error: "Invalid shareToken" }, { status: 400 });
      }
      const project = await db.project.findUnique({
        where: { shareToken: token },
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      return NextResponse.json(project);
    }

    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.project.findFirst({
      where: { id: id!, userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
