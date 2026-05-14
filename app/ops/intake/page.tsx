import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";

export default async function OpsIntakePage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/signin?next=/ops/intake");

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 max-w-xl mx-auto space-y-6">
      <Link href="/ops" className="text-blue-400 text-sm font-bold">
        ← Back
      </Link>
      <h1 className="text-2xl font-black">Client intake</h1>
      <p className="text-slate-400 text-sm">
        Wire this form to create `Client` + `Deliverable` and kick `runDirectorPipeline`. Fields are placeholders for
        concierge workflow.
      </p>
    </div>
  );
}
