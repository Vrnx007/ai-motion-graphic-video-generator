import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

export function getDirectorCacheRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redis = null;
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

export async function directorCacheGet(key: string): Promise<string | null> {
  const r = getDirectorCacheRedis();
  if (!r) return null;
  return r.get(key);
}

export async function directorCacheSet(key: string, value: string, ttlSec: number): Promise<void> {
  const r = getDirectorCacheRedis();
  if (!r) return;
  await r.set(key, value, { ex: ttlSec });
}
