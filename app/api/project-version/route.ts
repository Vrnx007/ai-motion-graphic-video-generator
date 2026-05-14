import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/prisma";

/** Freeze an approved cut to `project_version` (v1, v2, …). */
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { projectId, label, videoUrl, bundleUrl } = await req.json();
  if (!projectId || typeof label !== "string") {
    return NextResponse.json({ error: "projectId and label required" }, { status: 400 });
  }
  const project = await db.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const v = await db.projectVersion.create({
    data: {
      projectId,
      label,
      videoUrl: typeof videoUrl === "string" ? videoUrl : null,
      bundleUrl: typeof bundleUrl === "string" ? bundleUrl : null,
    },
  });
  return NextResponse.json({ id: v.id });
}
