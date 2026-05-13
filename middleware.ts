import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest, rateLimitHit } from "@/lib/rate-limit";

const ROUTE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/auth/login": { limit: 25, windowMs: 15 * 60 * 1000 },
  "/api/generate-video": { limit: 80, windowMs: 60 * 60 * 1000 },
  "/api/generate-script": { limit: 60, windowMs: 60 * 60 * 1000 },
  "/api/generate-variations": { limit: 40, windowMs: 60 * 60 * 1000 },
  "/api/extract-brand": { limit: 35, windowMs: 60 * 60 * 1000 },
};

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const cfg = ROUTE_LIMITS[path];
  if (!cfg) return NextResponse.next();

  const reqLike = new Request(request.url, { headers: request.headers });
  const ip = clientIpFromRequest(reqLike);
  const hit = rateLimitHit(`${path}:${ip}`, cfg.limit, cfg.windowMs);
  if (!hit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(hit.retryAfterSec) },
      }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/auth/login",
    "/api/generate-video",
    "/api/generate-script",
    "/api/generate-variations",
    "/api/extract-brand",
  ],
};
