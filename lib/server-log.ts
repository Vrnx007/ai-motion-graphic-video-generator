/**
 * Structured server logs (no third-party dependency). Optional Sentry when SDK supports Next 16.
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
