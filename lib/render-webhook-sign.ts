import { createHmac, timingSafeEqual } from "crypto";

export function signRenderWebhookBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyRenderWebhookSignature(secret: string, body: string, sigHeader: string | null): boolean {
  if (!sigHeader || !secret) return false;
  const expected = signRenderWebhookBody(secret, body);
  try {
    const a = Buffer.from(sigHeader, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
