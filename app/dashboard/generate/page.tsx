import GenerateClient from "./GenerateClient";
import { Suspense } from "react";

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-screen bg-[#0f172a] text-slate-400 text-sm font-bold uppercase tracking-widest">Loading studio…</div>}>
      <GenerateClient />
    </Suspense>
  );
}
