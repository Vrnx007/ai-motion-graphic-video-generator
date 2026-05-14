import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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
 * Fixed-window rate limiter (in-memory). Used when Upstash env is not configured.
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

let redisSingleton: Redis | null | undefined;

function getUpstashRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisSingleton = null;
    return null;
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

function windowMsToSlidingString(windowMs: number): Parameters<typeof Ratelimit.slidingWindow>[1] {
  const sec = Math.max(1, Math.ceil(windowMs / 1000));
  if (sec <= 120) return `${sec} s`;
  const min = Math.max(1, Math.ceil(windowMs / 60_000));
  if (min <= 120) return `${min} m`;
  const hr = Math.max(1, Math.ceil(windowMs / 3_600_000));
  return `${hr} h`;
}

const ratelimiters = new Map<string, Ratelimit>();

function getSlidingRatelimit(limit: number, windowMs: number): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;
  const cacheKey = `${limit}@${windowMs}`;
  let rl = ratelimiters.get(cacheKey);
  if (!rl) {
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, windowMsToSlidingString(windowMs)),
      analytics: true,
      prefix: "motion-ai-ratelimit",
    });
    ratelimiters.set(cacheKey, rl);
  }
  return rl;
}

/**
 * Prefer Upstash sliding window when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set.
 */
export async function rateLimitHitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: true } | { allowed: false; retryAfterSec: number }> {
  const sliding = getSlidingRatelimit(limit, windowMs);
  if (!sliding) {
    return rateLimitHit(key, limit, windowMs);
  }
  const res = await sliding.limit(key);
  if (!res.success) {
    const retryAfterSec = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    return { allowed: false, retryAfterSec };
  }
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
