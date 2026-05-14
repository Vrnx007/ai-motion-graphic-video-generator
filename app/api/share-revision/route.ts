import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const shareToken = typeof body.shareToken === "string" ? body.shareToken : "";
    const notes = typeof body.notes === "string" ? body.notes : "";
    const requestedBy = typeof body.requestedBy === "string" ? body.requestedBy : "client@unknown";
    if (!shareToken) {
      return NextResponse.json({ error: "shareToken required" }, { status: 400 });
    }
    const project = await db.project.findUnique({
      where: { shareToken },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pseudoEmail = `share-${shareToken}@clients.local`;
    let client = await db.client.findFirst({ where: { contactEmail: pseudoEmail } });
    if (!client) {
      client = await db.client.create({
        data: {
          name: "Share reviewer",
          contactEmail: pseudoEmail,
        },
      });
    }

    const deliverable = await db.deliverable.create({
      data: {
        clientId: client.id,
        projectId: project.id,
        status: "review",
      },
    });
    const revision = await db.revision.create({
      data: {
        deliverableId: deliverable.id,
        requestedBy,
        notes,
        status: "open",
      },
    });
    await db.deliverableEvent.create({
      data: {
        deliverableId: deliverable.id,
        kind: "revision_requested",
        payload: { revisionId: revision.id, notes },
      },
    });

    return NextResponse.json({ ok: true, revisionId: revision.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
