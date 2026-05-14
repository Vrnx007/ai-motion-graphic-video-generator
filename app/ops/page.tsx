import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/prisma";

export default async function OpsHome() {
  const session = await getServerSession();
  if (!session?.user) redirect("/signin?next=/ops");

  const rows = await db.deliverable.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { client: true, project: true },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-black">Ops cockpit</h1>
          <Link href="/ops/intake" className="text-blue-400 font-bold">
            New intake
          </Link>
        </div>
        <div className="grid gap-3">
          {rows.map((d) => (
            <div key={d.id} className="rounded-2xl border border-white/10 p-4 bg-white/5">
              <div className="text-xs text-slate-400">{d.status}</div>
              <div className="font-bold">{d.client.name}</div>
              <div className="text-sm text-slate-300">{d.project?.prompt?.slice(0, 120)}</div>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-slate-500">No deliverables yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
