/**
 * Read a fetch Response as JSON. Fails with a clear message if the server returned HTML (crash, auth page, platform error).
 */
export async function parseApiJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    if (res.status === 401) throw new Error("Please sign in again.");
    throw new Error(`Empty response from server (${res.status}).`);
  }
  const first = trimmed[0];
  if (first !== "{" && first !== "[") {
    if (res.status === 401) throw new Error("Please sign in again.");
    throw new Error(
      `Server returned non-JSON (${res.status}). Usually a server crash, missing API route, or bad deployment — check logs.`
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`Invalid JSON from server (${res.status}).`);
  }
}
