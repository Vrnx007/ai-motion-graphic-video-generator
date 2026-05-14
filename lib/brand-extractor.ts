/**
 * Brand Extractor — Self-hosted pipeline for extracting brand identity from a URL.
 *
 * Pipeline:
 * 1. Fetch HTML with Chrome User-Agent
 * 2. Parse DOM with cheerio
 * 3. Resolve logo (5-tier chain)
 * 4. Resolve brand colors (meta → CSS vars → logo palette)
 * 5. Extract images (hero, product, OG)
 * 6. Extract content (headline, subheadline, features, CTA)
 */

import * as cheerio from "cheerio";
import sharp from "sharp";
import {
  normalizeColor,
  hexToRgb,
  isNearWhite,
  isNearBlack,
  isMutedGray,
  euclideanDistance,
  pickBestAccent,
  mergeBrandPalette,
  findFirstUsableColor,
  rgbSaturation,
} from "./color-utils";
import { fetchWithRedirectSafety, isUrlSafeForServerFetch } from "./url-safety";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const FETCH_TIMEOUT = 12_000;

// Blacklist patterns for ad/tracker images
const IMG_BLACKLIST = /doubleclick|googlesyndication|googleadservices|facebook\.com\/tr|pixel|analytics|tracking|beacon|1x1|spacer|blank\.gif/i;

/** Paths that are almost never usable raster heroes */
const NON_IMAGE_PATH = /\.(js|mjs|cjs|ts|tsx|jsx|css|json|map|html|htm|woff2?|ttf|eot|otf|mp4|webm|mov|pdf|zip)(\?|$)/i;

/** Known image-ish extensions (incl. svg, modern raster) */
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|svg|jxl|bmp|ico)(\?|$)/i;

function isLikelyImageAssetUrl(href: string): boolean {
  if (!href || href.startsWith("data:")) return false;
  if (IMG_BLACKLIST.test(href)) return false;
  try {
    const { pathname } = new URL(href, "https://example.com");
    if (NON_IMAGE_PATH.test(pathname)) return false;
    if (IMAGE_EXT_RE.test(pathname)) return true;
    // WordPress / CDNs often omit extensions — allow query hints
    if (/[?&](format=webp|format=avif|type=image)/i.test(href)) return true;
  } catch {
    return false;
  }
  return true;
}

/** Pick the largest candidate from an HTML srcset string */
function pickLargestFromSrcset(srcset: string | undefined, baseUrl: string): string | null {
  if (!srcset?.trim()) return null;
  let bestUrl: string | null = null;
  let bestScore = -1;
  for (const part of srcset.split(",")) {
    const t = part.trim();
    if (!t) continue;
    const bits = t.split(/\s+/);
    const raw = bits[0];
    if (!raw) continue;
    let score = 0;
    for (let i = 1; i < bits.length; i++) {
      const w = bits[i].match(/^(\d+)w$/i);
      if (w) score = Math.max(score, parseInt(w[1], 10));
      const x = bits[i].match(/^(\d+(?:\.\d+)?)x$/i);
      if (x) score = Math.max(score, Math.round(parseFloat(x[1]) * 1000));
    }
    const resolved = resolveUrl(raw, baseUrl);
    if (score >= bestScore) {
      bestScore = score;
      bestUrl = resolved;
    }
  }
  return bestUrl;
}

export interface BrandData {
  logoUrl: string | null;
  colors: {
    primary: string;
    secondary: string | null;
    accent: string | null;
    background: string;
    text: string;
  };
  brandPalette: string[];
  fonts: { heading: string; body: string };
  headline: string | null;
  subheadline: string | null;
  features: Array<{ title: string; description: string }>;
  cta: string | null;
  tone: string | null;
  style: string | null;
  images: Array<{ url: string; alt: string; context: string }>;
  testimonials: Array<{ quote: string; author?: string; role?: string }>;
  integrations: Array<{ name: string; logoUrl?: string | null }>;
  pricingCues: string[];
}

// ─── Helpers ──────────────────────────────────────────────

async function safeFetch(
  url: string,
  opts: { timeout?: number; acceptImage?: boolean } = {}
): Promise<Response | null> {
  try {
    const safe = isUrlSafeForServerFetch(url);
    if (!safe.ok) return null;
    const headers: Record<string, string> = { "User-Agent": CHROME_UA };
    if (opts.acceptImage) headers["Accept"] = "image/*";
    const res = await fetchWithRedirectSafety(url, {
      headers,
      timeoutMs: opts.timeout ?? FETCH_TIMEOUT,
    });
    if (!res || !res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

// ─── Logo Resolution (5-tier chain) ──────────────────────

async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const res = await safeFetch(url, { acceptImage: true });
    if (!res) return false;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("image")) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return false;
    // SVGs skip raster validation
    if (ct.includes("svg")) return true;
    try {
      const meta = await sharp(buf).metadata();
      if (!meta.width || !meta.height) return false;
      if (meta.width < 32 || meta.height < 32) return false;
      if (Math.max(meta.width, meta.height) / Math.min(meta.width, meta.height) > 8) return false;
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

// Known Google favicon default-globe fingerprint byte lengths
const GOOGLE_FAVICON_DEFAULT_SIZES = new Set([726, 414, 318, 262]);

async function resolveLogo(
  $: cheerio.CheerioAPI,
  baseUrl: string
): Promise<string | null> {
  const domain = getDomain(baseUrl);

  // Tier 1: Clearbit
  const clearbitUrl = `https://logo.clearbit.com/${domain}?size=500`;
  if (await validateImageUrl(clearbitUrl)) return clearbitUrl;

  // Tier 2: DOM-scraped candidates (4 sub-tiers)
  const candidates: string[] = [];

  // 2a: <img> inside <header>/<nav> with logo class/id/alt
  $("header img, nav img").each((_, el) => {
    const src = $(el).attr("src");
    const cls = ($(el).attr("class") || "").toLowerCase();
    const id = ($(el).attr("id") || "").toLowerCase();
    const alt = ($(el).attr("alt") || "").toLowerCase();
    if (src && (cls.includes("logo") || id.includes("logo") || alt.includes("logo"))) {
      const resolved = resolveUrl(src, baseUrl);
      if (!IMG_BLACKLIST.test(resolved)) candidates.push(resolved);
    }
  });

  // 2b: <a class="brand|logo">…<img>
  $('a[class*="brand"] img, a[class*="logo"] img').each((_, el) => {
    const src = $(el).attr("src");
    if (src) {
      const resolved = resolveUrl(src, baseUrl);
      if (!IMG_BLACKLIST.test(resolved)) candidates.push(resolved);
    }
  });

  // 2c: Any non-footer/aside img with logo class/id/alt
  $("img").each((_, el) => {
    const parent = $(el).closest("footer, aside");
    if (parent.length > 0) return;
    const src = $(el).attr("src");
    const cls = ($(el).attr("class") || "").toLowerCase();
    const id = ($(el).attr("id") || "").toLowerCase();
    const alt = ($(el).attr("alt") || "").toLowerCase();
    if (src && (cls.includes("logo") || id.includes("logo") || alt.includes("logo"))) {
      const resolved = resolveUrl(src, baseUrl);
      if (!IMG_BLACKLIST.test(resolved) && !candidates.includes(resolved)) {
        candidates.push(resolved);
      }
    }
  });

  // 2d: Any <img> whose src path contains "logo"
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (src.toLowerCase().includes("logo")) {
      const resolved = resolveUrl(src, baseUrl);
      if (!IMG_BLACKLIST.test(resolved) && !src.startsWith("data:") && !candidates.includes(resolved)) {
        candidates.push(resolved);
      }
    }
  });

  for (const c of candidates) {
    if (await validateImageUrl(c)) return c;
  }

  // Tier 3: Google favicon API
  for (const sz of [128, 64, 48, 32]) {
    const gUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=${sz}`;
    const res = await safeFetch(gUrl, { acceptImage: true });
    if (res) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (!GOOGLE_FAVICON_DEFAULT_SIZES.has(buf.length) && buf.length >= 500) {
        return gUrl;
      }
    }
  }

  // Tier 4: <link rel="icon|apple-touch-icon"> sorted by size
  const linkIcons: Array<{ href: string; size: number }> = [];
  $('link[rel*="icon"], link[rel="apple-touch-icon"]').each((_, el) => {
    const href = $(el).attr("href");
    const sizes = $(el).attr("sizes") || "0x0";
    const sizeNum = parseInt(sizes.split("x")[0]) || 0;
    if (href) linkIcons.push({ href: resolveUrl(href, baseUrl), size: sizeNum });
  });
  linkIcons.sort((a, b) => b.size - a.size);
  for (const icon of linkIcons) {
    if (await validateImageUrl(icon.href)) return icon.href;
  }

  // Tier 5: /favicon.ico
  const faviconUrl = `${getOrigin(baseUrl)}/favicon.ico`;
  if (await validateImageUrl(faviconUrl)) return faviconUrl;

  return null;
}

// ─── Color Resolution ────────────────────────────────────

function resolveSiteBrandColor($: cheerio.CheerioAPI, html: string): string | null {
  // Priority 1: <meta name="theme-color">
  const themeColorMetas: Array<{ color: string; media: string }> = [];
  $('meta[name="theme-color"]').each((_, el) => {
    const content = $(el).attr("content");
    const media = $(el).attr("media") || "";
    if (content) themeColorMetas.push({ color: content, media });
  });
  // Prefer no-media > light > dark
  const sorted = themeColorMetas.sort((a, b) => {
    if (!a.media && b.media) return -1;
    if (a.media && !b.media) return 1;
    if (a.media.includes("light") && !b.media.includes("light")) return -1;
    return 0;
  });
  for (const tc of sorted) {
    const norm = normalizeColor(tc.color);
    if (norm) {
      const [r, g, b] = hexToRgb(norm);
      if (!isNearWhite(r, g, b) && !isNearBlack(r, g, b)) return norm;
    }
  }

  // Priority 2: PWA manifest theme_color / background_color
  const manifestHref = $('link[rel="manifest"]').attr("href");
  // Skip manifest fetching (would need async) - handled in extractFromUrl if needed

  // Priority 3: CSS custom properties scan
  const cssVarPatterns = [
    /--brand[^:]*:\s*([^;]+)/gi,
    /--primary[^:]*:\s*([^;]+)/gi,
    /--accent[^:]*:\s*([^;]+)/gi,
    /--theme-color[^:]*:\s*([^;]+)/gi,
    /--bs-primary[^:]*:\s*([^;]+)/gi,
    /--main-color[^:]*:\s*([^;]+)/gi,
    /--site-color[^:]*:\s*([^;]+)/gi,
  ];
  for (const pattern of cssVarPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const val = match[1].trim();
      if (val.startsWith("var(")) continue; // can't resolve var references
      const norm = normalizeColor(val);
      if (norm) {
        const [r, g, b] = hexToRgb(norm);
        if (!isNearWhite(r, g, b) && !isNearBlack(r, g, b)) return norm;
      }
    }
  }

  // Priority 4: msapplication-TileColor
  const tileColor = $('meta[name="msapplication-TileColor"]').attr("content");
  if (tileColor) {
    const norm = normalizeColor(tileColor);
    if (norm) {
      const [r, g, b] = hexToRgb(norm);
      if (!isNearWhite(r, g, b) && !isNearBlack(r, g, b)) return norm;
    }
  }

  // Priority 5: Safari mask-icon color
  const maskColor = $('link[rel="mask-icon"]').attr("color");
  if (maskColor) {
    const norm = normalizeColor(maskColor);
    if (norm) {
      const [r, g, b] = hexToRgb(norm);
      if (!isNearWhite(r, g, b) && !isNearBlack(r, g, b)) return norm;
    }
  }

  // Second pass: accept near-white/black if nothing else
  for (const tc of sorted) {
    const norm = normalizeColor(tc.color);
    if (norm) return norm;
  }

  return null;
}

// ─── Logo Color Palette Extraction ───────────────────────

async function extractColorPalette(imageUrl: string): Promise<string[]> {
  try {
    const res = await safeFetch(imageUrl, { acceptImage: true });
    if (!res) return [];
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "";

    // For SVG/ICO, use Google favicon PNG as proxy
    let imageBuf = buf;
    if (ct.includes("svg") || ct.includes("icon")) {
      const domain = getDomain(imageUrl);
      const gRes = await safeFetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`, { acceptImage: true });
      if (!gRes) return [];
      imageBuf = Buffer.from(await gRes.arrayBuffer());
    }

    // Resize to 30x30 for sampling
    const { data, info } = await sharp(imageBuf)
      .resize(30, 30, { fit: "fill" })
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    // Count color frequencies (bucketed to nearest 8)
    const colorCounts = new Map<string, number>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip transparent
      if (a < 128) continue;
      // Skip near-white, near-black, muted gray
      if (isNearWhite(r, g, b) || isNearBlack(r, g, b) || isMutedGray(r, g, b)) continue;

      // Bucket to nearest 8
      const br = Math.round(r / 8) * 8;
      const bg = Math.round(g / 8) * 8;
      const bb = Math.round(b / 8) * 8;
      const key = `${br},${bg},${bb}`;
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    // Sort by frequency
    const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);

    // Pick up to 5 distinct colors (Euclidean distance >= 80)
    const palette: string[] = [];
    for (const [key] of sorted) {
      if (palette.length >= 5) break;
      const [r, g, b] = key.split(",").map(Number);
      const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
      const rgb: [number, number, number] = [r, g, b];
      const tooClose = palette.some(
        (existing) => euclideanDistance(rgb, hexToRgb(existing)) < 80
      );
      if (!tooClose) palette.push(hex);
    }

    return palette;
  } catch {
    return [];
  }
}

// ─── Image Extraction ────────────────────────────────────

function pushImage(
  images: Array<{ url: string; alt: string; context: string }>,
  seen: Set<string>,
  url: string,
  alt: string,
  context: string,
  max: number
): void {
  if (images.length >= max) return;
  if (!url || url.startsWith("data:") || IMG_BLACKLIST.test(url)) return;
  if (!isLikelyImageAssetUrl(url)) return;
  if (seen.has(url)) return;
  seen.add(url);
  images.push({ url, alt: alt || "", context });
}

function extractImages(
  $: cheerio.CheerioAPI,
  baseUrl: string
): Array<{ url: string; alt: string; context: string }> {
  const images: Array<{ url: string; alt: string; context: string }> = [];
  const seen = new Set<string>();
  const max = 22;

  // OG images (highest priority)
  $('meta[property="og:image"], meta[name="og:image"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) {
      const url = resolveUrl(content, baseUrl);
      pushImage(images, seen, url, "Open Graph image", "og", max);
    }
  });

  // Twitter card images
  $('meta[name="twitter:image"], meta[property="twitter:image"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) {
      const url = resolveUrl(content, baseUrl);
      pushImage(images, seen, url, "Twitter card image", "social", max);
    }
  });

  // Legacy image_src link
  $('link[rel="image_src"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const url = resolveUrl(href, baseUrl);
      pushImage(images, seen, url, "Image link", "link", max);
    }
  });

  // Preloaded hero / LCP candidates
  $('link[rel="preload"][as="image"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const url = resolveUrl(href, baseUrl);
      pushImage(images, seen, url, "Preload image", "preload", max);
    }
  });

  // Video posters (often high-res marketing stills)
  $("video[poster]").each((_, el) => {
    const poster = $(el).attr("poster");
    if (poster) {
      const url = resolveUrl(poster, baseUrl);
      pushImage(images, seen, url, "Video poster", "poster", max);
    }
  });

  // <picture> — prefer largest source from srcset
  $("picture").each((_, pic) => {
    const $pic = $(pic);
    let best: string | null = null;
    $pic.find("source").each((__, srcEl) => {
      const srcset = $(srcEl).attr("srcset");
      const picked = pickLargestFromSrcset(srcset, baseUrl);
      if (picked) best = picked;
    });
    const imgSrc = $pic.find("img").first().attr("src") || $pic.find("img").first().attr("data-src");
    const fromSrcset = best;
    const fromImg = imgSrc ? resolveUrl(imgSrc, baseUrl) : null;
    const url = fromSrcset || fromImg;
    if (url) {
      const alt = $pic.find("img").first().attr("alt") || "";
      pushImage(images, seen, url, alt, "picture", max);
    }
  });

  // Hero section images (large images in main/section/hero areas)
  $("main img, section img, [class*='hero'] img, [class*='banner'] img, [id*='hero'] img").each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr("srcset");
    const picked = pickLargestFromSrcset(srcset, baseUrl);
    const src = picked || $el.attr("src") || $el.attr("data-src");
    if (!src || src.startsWith("data:")) return;
    const url = resolveUrl(src, baseUrl);
    const alt = $el.attr("alt") || "";
    pushImage(images, seen, url, alt, "hero", max);
  });

  // Product / feature images
  $("img").each((_, el) => {
    if (images.length >= max) return;
    const $el = $(el);
    const srcset = $el.attr("srcset");
    const picked = pickLargestFromSrcset(srcset, baseUrl);
    const src = picked || $el.attr("src") || $el.attr("data-src");
    if (!src || src.startsWith("data:") || IMG_BLACKLIST.test(src)) return;
    const url = resolveUrl(src, baseUrl);
    if (seen.has(url)) return;
    const width = parseInt($el.attr("width") || "0", 10);
    const height = parseInt($el.attr("height") || "0", 10);
    if ((width > 0 && width < 40) || (height > 0 && height < 40)) return;
    const alt = $el.attr("alt") || "";
    pushImage(images, seen, url, alt, "page", max);
  });

  return images.slice(0, 18);
}

// ─── Content Extraction ──────────────────────────────────

function extractContent($: cheerio.CheerioAPI): {
  headline: string | null;
  subheadline: string | null;
  features: Array<{ title: string; description: string }>;
  cta: string | null;
  fonts: { heading: string; body: string };
} {
  // Headline: first <h1>, then og:title, then <title>
  let headline =
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().trim() ||
    null;

  // Subheadline: text near the h1 (next sibling p, or og:description)
  let subheadline =
    $("h1").first().next("p").text().trim() ||
    $("h1").first().parent().find("p").first().text().trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    null;

  // Features: look for repeated heading+text patterns
  const features: Array<{ title: string; description: string }> = [];
  $("h2, h3").each((_, el) => {
    if (features.length >= 6) return;
    const title = $(el).text().trim();
    const desc = $(el).next("p").text().trim();
    if (title && title.length > 3 && title.length < 100) {
      features.push({ title, description: desc || "" });
    }
  });

  // CTA: look for primary buttons/links
  let cta: string | null = null;
  const ctaSelectors = [
    'a[class*="cta"]', 'button[class*="cta"]',
    'a[class*="primary"]', 'button[class*="primary"]',
    'a[class*="hero"] button', '[class*="hero"] a',
    'a[class*="btn-primary"]', '.hero a', '.hero button',
  ];
  for (const sel of ctaSelectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = el.text().trim();
      if (text && text.length > 2 && text.length < 50) {
        cta = text;
        break;
      }
    }
  }
  if (!cta) {
    // Fallback: any button or link with action-y text
    $("a, button").each((_, el) => {
      if (cta) return;
      const text = $(el).text().trim().toLowerCase();
      if (
        text.match(/^(get started|sign up|try|start|join|book|contact|schedule|request|learn more)/i) &&
        text.length < 40
      ) {
        cta = $(el).text().trim();
      }
    });
  }

  // Fonts: extract from inline styles or common patterns
  let headingFont = "Inter";
  let bodyFont = "Inter";
  const fontFamilyMatch = $("h1, h2").first().attr("style")?.match(/font-family:\s*([^;]+)/);
  if (fontFamilyMatch) {
    headingFont = fontFamilyMatch[1].split(",")[0].replace(/['"]/g, "").trim();
  }

  return { headline, subheadline, features, cta, fonts: { heading: headingFont, body: bodyFont } };
}

function extractTestimonials($: cheerio.CheerioAPI, baseUrl: string): Array<{ quote: string; author?: string; role?: string }> {
  const out: Array<{ quote: string; author?: string; role?: string }> = [];
  const seen = new Set<string>();
  $("blockquote, [class*='testimonial'], [data-testid*='testimonial']").each((_, el) => {
    if (out.length >= 5) return;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 24 || text.length > 400) return;
    const key = text.slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    const author =
      $(el).find("cite, footer, .author, [class*='author']").first().text().trim() || undefined;
    out.push({ quote: text.slice(0, 320), author: author || undefined });
  });
  return out;
}

function extractIntegrations($: cheerio.CheerioAPI, baseUrl: string): Array<{ name: string; logoUrl?: string | null }> {
  const out: Array<{ name: string; logoUrl?: string | null }> = [];
  const seen = new Set<string>();
  $("[class*='integration'], [class*='partner'], [class*='logo-wall'] img, [class*='logos'] img").each((_, el) => {
    if (out.length >= 12) return;
    const alt = ($(el).attr("alt") || "").trim();
    const src = $(el).attr("src");
    if (!alt || alt.length < 2 || alt.length > 80) return;
    const lower = alt.toLowerCase();
    if (lower.includes("logo") || lower.includes("icon")) {
      const name = alt.replace(/\s*logo\s*/i, "").trim();
      if (!name || seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      const logoUrl = src ? resolveUrl(src, baseUrl) : undefined;
      out.push({ name, logoUrl: logoUrl || null });
    }
  });
  return out;
}

function extractPricingCues($: cheerio.CheerioAPI): string[] {
  const cues: string[] = [];
  const body = $("body").text();
  const re = /\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:mo|month|yr|year))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null && cues.length < 8) {
    const s = m[0].trim();
    if (!cues.includes(s)) cues.push(s);
  }
  $("[class*='pricing'], [class*='plan']").each((_, el) => {
    if (cues.length >= 8) return false;
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > 8 && t.length < 120 && /free|trial|\/|mo|month|\$/i.test(t)) {
      const key = t.slice(0, 80);
      if (!cues.includes(key)) cues.push(key);
    }
    return undefined;
  });
  return cues.slice(0, 8);
}

// ─── Main Pipeline ───────────────────────────────────────

export async function extractFromUrl(url: string): Promise<BrandData> {
  console.log(`[BrandExtractor] Starting extraction for: ${url}`);

  // 1. Fetch HTML
  const res = await safeFetch(url);
  if (!res) throw new Error(`Failed to fetch ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  console.log("[BrandExtractor] HTML fetched, parsing DOM...");

  // 2. Run extractions in parallel
  const [logoUrl, siteBrandColor, content, siteImages] = await Promise.all([
    resolveLogo($, url),
    Promise.resolve(resolveSiteBrandColor($, html)),
    Promise.resolve(extractContent($)),
    Promise.resolve(extractImages($, url)),
  ]);

  const testimonials = extractTestimonials($, url);
  const integrations = extractIntegrations($, url);
  const pricingCues = extractPricingCues($);

  console.log(`[BrandExtractor] Logo: ${logoUrl ? "found" : "not found"}`);
  console.log(`[BrandExtractor] Site brand color: ${siteBrandColor || "not found"}`);

  // 3. Extract color palette from logo
  let logoPalette: string[] = [];
  if (logoUrl) {
    logoPalette = await extractColorPalette(logoUrl);
    console.log(`[BrandExtractor] Logo palette: ${logoPalette.length} colors`);
  }

  // 4. Assemble final colors
  let primary: string;
  if (siteBrandColor) {
    primary = siteBrandColor;
  } else {
    primary = pickBestAccent(logoPalette) || "#3B82F6"; // fallback blue
  }

  // Guard: replace near-white/black primary
  const [pr, pg, pb] = hexToRgb(primary);
  if (isNearWhite(pr, pg, pb) || isNearBlack(pr, pg, pb)) {
    primary = findFirstUsableColor(logoPalette) || "#3B82F6";
  }

  const brandPalette = mergeBrandPalette(primary, logoPalette, 8);
  const secondary = brandPalette[1] || null;
  const accent = brandPalette[2] || brandPalette[0] || null;

  // 5. Determine tone and style from content signals
  const tone = inferTone($, html);
  const style = inferStyle($, html);

  const result: BrandData = {
    logoUrl,
    colors: {
      primary,
      secondary,
      accent,
      background: "#0F172A", // Default dark
      text: "#FFFFFF",
    },
    brandPalette,
    fonts: content.fonts,
    headline: content.headline,
    subheadline: content.subheadline,
    features: content.features,
    cta: content.cta,
    tone,
    style,
    images: siteImages,
    testimonials,
    integrations,
    pricingCues,
  };

  console.log("[BrandExtractor] Extraction complete:", {
    logo: !!result.logoUrl,
    primary: result.colors.primary,
    paletteSize: result.brandPalette.length,
    imageCount: result.images.length,
    features: result.features.length,
  });

  return result;
}

// ─── Tone & Style Inference ──────────────────────────────

function inferTone($: cheerio.CheerioAPI, html: string): string {
  const text = $("body").text().toLowerCase();
  if (text.match(/enterprise|compliance|security|scale|govern/)) return "professional";
  if (text.match(/fun|playful|creative|delight|joy/)) return "playful";
  if (text.match(/premium|luxury|exclusive|bespoke/)) return "premium";
  if (text.match(/fast|ship|launch|move|speed|hack/)) return "startup";
  if (text.match(/simple|easy|intuitive|effortless|clean/)) return "minimal";
  return "professional";
}

function inferStyle($: cheerio.CheerioAPI, html: string): string {
  if (html.match(/backdrop-filter|blur\(/i)) return "glassmorphism";
  if (html.match(/gradient/i)) return "gradient";
  if (html.match(/border-radius:\s*(1[2-9]|[2-9]\d)px/i)) return "rounded";
  if (html.match(/dark|#0[0-3]/i)) return "dark";
  return "modern";
}
