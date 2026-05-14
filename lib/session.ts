import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "motion_ai_session";

/** OWASP-style minimum for HMAC session secrets */
const MIN_SECRET_LEN = 48;

function getSecret(): string | null {
  const s = process.env.SESSION_SECRET?.trim();
  if (!s || s.length < MIN_SECRET_LEN) return null;
  return s;
}

export function signSessionToken(userId: string): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET must be set (at least 48 characters)");
  }
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const payload = Buffer.from(JSON.stringify({ userId, exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { userId: string } | null {
  const secret = getSecret();
  if (!secret) return null;
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
