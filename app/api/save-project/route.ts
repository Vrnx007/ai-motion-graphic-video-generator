import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      projectId,
      videoCode,
      prompt,
      duration,
      aspectRatio,
      scenes: scenesPayload,
      videoType: videoTypePayload,
      musicMood: musicMoodPayload,
    } = await req.json();

    if (!videoCode || !prompt) {
      return NextResponse.json({ error: "Missing video code or prompt" }, { status: 400 });
    }

    const validatedDuration = Math.round(Math.min(Math.max(Number(duration) || 10, 5), 300));

    const scenesJson =
      scenesPayload !== undefined && scenesPayload !== null
        ? Array.isArray(scenesPayload)
          ? scenesPayload
          : scenesPayload
        : undefined;

    const data = {
      videoCode,
      prompt,
      duration: validatedDuration,
      aspectRatio: aspectRatio || "16:9",
      scenes:
        scenesJson === undefined ? undefined : (JSON.parse(JSON.stringify(scenesJson)) as object),
      videoType:
        typeof videoTypePayload === "string" && videoTypePayload.length > 0
          ? videoTypePayload.slice(0, 64)
          : "general",
      musicMood:
        typeof musicMoodPayload === "string" && musicMoodPayload.length > 0
          ? musicMoodPayload.slice(0, 120)
          : null,
    };

    if (typeof projectId === "string" && projectId.length > 0) {
      const existing = await db.project.findFirst({
        where: { id: projectId, userId: session.user.id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const project = await db.project.update({
        where: { id: projectId },
        data,
      });
      return NextResponse.json({ id: project.id, shareToken: project.shareToken });
    }

    const project = await db.project.create({
      data: {
        ...data,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ id: project.id, shareToken: project.shareToken });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await db.project.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const project = await db.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
