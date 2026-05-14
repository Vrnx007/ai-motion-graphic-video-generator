import { db } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await ctx.params;
  const job = await db.renderJob.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      status: true,
      progress: true,
      outputUrl: true,
      error: true,
      costCents: true,
      spendBreakdown: true,
      updatedAt: true,
    },
  });
  if (!job) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send(job);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
