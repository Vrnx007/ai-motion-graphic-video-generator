/**
 * Load sharp lazily so a broken native binding does not crash the whole route module.
 * Falls back to no-ops where callers handle null.
 */
type Sharp = typeof import("sharp");

let sharpMod: Sharp | null | undefined;

export async function getSharp(): Promise<Sharp | null> {
  if (sharpMod === null) return null;
  if (sharpMod !== undefined) return sharpMod;
  try {
    sharpMod = (await import("sharp")).default;
    return sharpMod;
  } catch (e) {
    console.warn("[sharp-safe] sharp unavailable, image probes will be lenient:", e);
    sharpMod = null;
    return null;
  }
}
