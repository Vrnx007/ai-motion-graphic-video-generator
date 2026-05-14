export default function ScrapeConsentPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-200">
      <h1 className="text-3xl font-black text-white mb-6">Brand scrape consent</h1>
      <p className="text-sm leading-relaxed text-slate-400">
        Intake should record that the client authorizes automated fetching of their public website for brand marks,
        colors, and typography. Capture a signed checkbox during `/ops/intake` before calling `/api/extract-brand`.
      </p>
    </main>
  );
}
