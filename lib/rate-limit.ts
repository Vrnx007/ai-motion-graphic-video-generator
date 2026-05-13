type Bucket = { count: number; resetAt: number };

const globalBuckets = globalThis as unknown as { __rateLimitBuckets?: Map<string, Bucket> };

function getBuckets(): Map<string, Bucket> {
  if (!globalBuckets.__rateLimitBuckets) {
    globalBuckets.__rateLimitBuckets = new Map();
  }
  return globalBuckets.__rateLimitBuckets;
}

function pruneMapIfHuge() {
  if (getBuckets().size <= 10_000) return;
  for (const k of getBuckets().keys()) {
    getBuckets().delete(k);
    if (getBuckets().size < 5000) break;
  }
}

/**
 * Fixed-window rate limiter (in-memory). Fine for single-node / dev; use Redis for multi-instance.
 */
export function rateLimitHit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const now = Date.now();
  pruneMapIfHuge();
  const bucketKey = `${key}`;
  let b = getBuckets().get(bucketKey);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    getBuckets().set(bucketKey, b);
  }
  if (b.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  b.count += 1;
  return { allowed: true };
}

export function clientIpFromRequest(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim().slice(0, 128);
  return "unknown";
}
