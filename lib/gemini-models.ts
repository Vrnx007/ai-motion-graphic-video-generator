/**
 * Comma- or space-separated Gemini model ids. First entry is primary; rest are fallbacks.
 */
function parseModelList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,]+|\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const DEFAULT_MODELS = ["gemini-3-flash-preview"];

/**
 * @param role "script" — generate-script (planning). "video" — generate-video per scene.
 */
export function getModelChain(role: "script" | "video"): string[] {
  const specific =
    role === "script"
      ? parseModelList(process.env.GEMINI_MODEL_SCRIPT)
      : parseModelList(process.env.GEMINI_MODEL_VIDEO);
  if (specific.length > 0) return specific;
  const shared = parseModelList(process.env.GEMINI_MODEL_CHAIN);
  if (shared.length > 0) return shared;
  return [...DEFAULT_MODELS];
}
