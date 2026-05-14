import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "motion_ai_session";

/**
 * Used when SESSION_SECRET is unset so login still works out of the box.
 * Set SESSION_SECRET in production for a unique signing key.
 */
const DEFAULT_SESSION_SECRET =
  "motion-ai-built-in-session-key-change-in-env-if-you-want-0123456789abcdef";

function resolveSecret(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[session] SESSION_SECRET is not set — using built-in default. Set SESSION_SECRET in production for stronger cookie signing."
    );
  }
  return DEFAULT_SESSION_SECRET;
}

export function signSessionToken(userId: string): string {
  const secret = resolveSecret();
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const payload = Buffer.from(JSON.stringify({ userId, exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { userId: string } | null {
  const secret = resolveSecret();
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: unknown;
      exp?: unknown;
    };
    if (typeof data.userId !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
