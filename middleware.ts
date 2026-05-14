import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clientIpFromRequest, rateLimitHitAsync } from "@/lib/rate-limit";

const ROUTE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/auth/login": { limit: 25, windowMs: 15 * 60 * 1000 },
  "/api/generate-video": { limit: 80, windowMs: 60 * 60 * 1000 },
  "/api/generate-script": { limit: 60, windowMs: 60 * 60 * 1000 },
  "/api/generate-variations": { limit: 40, windowMs: 60 * 60 * 1000 },
  "/api/extract-brand": { limit: 35, windowMs: 60 * 60 * 1000 },
};

function applySecurityHeaders(res: NextResponse) {
  const isProd = process.env.NODE_ENV === "production";
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https: wss:",
    "media-src 'self' https: blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()"
  );
  res.headers.set("X-Frame-Options", "DENY");
  if (isProd) {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  return res;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const cfg = ROUTE_LIMITS[path];
  if (cfg) {
    const reqLike = new Request(request.url, { headers: request.headers });
    const ip = clientIpFromRequest(reqLike);
    const hit = await rateLimitHitAsync(`${path}:${ip}`, cfg.limit, cfg.windowMs);
    if (!hit.allowed) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Too many requests" },
          {
            status: 429,
            headers: { "Retry-After": String(hit.retryAfterSec) },
          }
        )
      );
    }
  }
  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Apply security headers broadly; rate limits only match ROUTE_LIMITS keys.
     * Exclude static assets and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
