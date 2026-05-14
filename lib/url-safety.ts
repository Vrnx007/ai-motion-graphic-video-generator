import { isIPv4, isIPv6 } from "node:net";

/** Max bytes read from upstream when proxying images. */
export const IMAGE_PROXY_MAX_BYTES = 5 * 1024 * 1024;

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return -1;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isPrivateOrReservedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n < 0) return true;
  // 10.0.0.0/8
  if ((n >>> 24) === 10) return true;
  // 127.0.0.0/8
  if ((n >>> 24) === 127) return true;
  // 169.254.0.0/16 link-local
  if ((n >>> 16) === 0xa9fe) return true;
  // 172.16.0.0/12
  if ((n >>> 20) === 0xac1) return true;
  // 192.168.0.0/16
  if ((n >>> 16) === 0xc0a8) return true;
  // 0.0.0.0/8
  if ((n >>> 24) === 0) return true;
  // 100.64.0.0/10 CGNAT
  if ((n >>> 22) === 0x19a) return true;
  // 192.0.0.0/24 IETF Protocol
  if ((n >>> 8) === 0xc00000) return true;
  // 192.0.2.0/24 TEST-NET-1, 198.51.100.0/24 TEST-NET-2, 203.0.113.0/24 TEST-NET-3
  if ((n >>> 8) === 0xc00002 || (n >>> 8) === 0xc63364 || (n >>> 8) === 0xcb0071) return true;
  // 224.0.0.0/4 multicast + reserved
  if ((n >>> 28) >= 0xe) return true;
  return false;
}

/** Block obvious SSRF targets for server-side fetch (image proxy, etc.). */
export function isUrlSafeForServerFetch(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Invalid protocol" };
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, reason: "Host not allowed" };
  }
  if (host === "0.0.0.0" || host === "[::]" || host === "::") {
    return { ok: false, reason: "Host not allowed" };
  }
  if (isIPv4(host)) {
    if (isPrivateOrReservedIPv4(host)) return { ok: false, reason: "Private IP not allowed" };
    return { ok: true, url };
  }
  if (isIPv6(host)) {
    return { ok: false, reason: "IPv6 literal not allowed" };
  }
  return { ok: true, url };
}

const DEFAULT_MAX_REDIRECTS = 3;

/**
 * Follow redirects manually and re-validate each hop against SSRF rules.
 * Use instead of fetch(..., { redirect: "follow" }) for untrusted URLs.
 */
export async function fetchWithRedirectSafety(
  initialRawUrl: string,
  init: RequestInit & { timeoutMs?: number; maxRedirects?: number } = {}
): Promise<Response | null> {
  const maxRedirects = init.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let currentUrl = initialRawUrl;
  const timeoutMs = init.timeoutMs ?? 12_000;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const safe = isUrlSafeForServerFetch(currentUrl);
    if (!safe.ok) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(safe.url.toString(), {
        ...init,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timer);
      return null;
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc || hop >= maxRedirects) return null;
      try {
        currentUrl = new URL(loc, safe.url).href;
      } catch {
        return null;
      }
      continue;
    }
    return res;
  }
  return null;
}
