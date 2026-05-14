/**
 * Structured server logs (stdout JSON lines only — no third-party observability SDKs).
 */
export function logApiError(
  route: string,
  err: unknown,
  context?: Record<string, string | number | boolean | undefined>
): void {
  const message = err instanceof Error ? err.message : String(err);
  const line = JSON.stringify({
    level: "error",
    route,
    message,
    ...context,
    t: new Date().toISOString(),
  });
  console.error(line);
}
