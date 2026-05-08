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

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const FETCH_TIMEOUT = 12_000;

// Blacklist patterns for ad/tracker images
const IMG_BLACKLIST = /doubleclick|googlesyndication|googleadservices|facebook\.com\/tr|pixel|analytics|tracking|beacon|1x1|spacer|blank\.gif/i;

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
}

// ─── Helpers ──────────────────────────────────────────────

async function safeFetch(
  url: string,
  opts: { timeout?: number; acceptImage?: boolean } = {}
): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeout ?? FETCH_TIMEOUT);
    const headers: Record<string, string> = { "User-Agent": CHROME_UA };
    if (opts.acceptImage) headers["Accept"] = "image/*";
    const res = await fetch(url, { signal: controller.signal, headers, redirect: "follow" });
    clearTimeout(timer);
    if (!res.ok) return null;
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

function extractImages(
  $: cheerio.CheerioAPI,
  baseUrl: string
): Array<{ url: string; alt: string; context: string }> {
  const images: Array<{ url: string; alt: string; context: string }> = [];
  const seen = new Set<string>();

  // OG images (highest priority)
  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) {
      const url = resolveUrl(content, baseUrl);
      if (!seen.has(url)) {
        seen.add(url);
        images.push({ url, alt: "Open Graph image", context: "og" });
      }
    }
  });

  // Twitter card images
  $('meta[name="twitter:image"], meta[property="twitter:image"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) {
      const url = resolveUrl(content, baseUrl);
      if (!seen.has(url)) {
        seen.add(url);
        images.push({ url, alt: "Twitter card image", context: "social" });
      }
    }
  });

  // Hero section images (large images in main/section/hero areas)
  $("main img, section img, [class*='hero'] img, [class*='banner'] img, [id*='hero'] img").each(
    (_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (!src || src.startsWith("data:") || IMG_BLACKLIST.test(src)) return;
      const url = resolveUrl(src, baseUrl);
      if (seen.has(url)) return;
      const alt = $(el).attr("alt") || "";
      seen.add(url);
      images.push({ url, alt, context: "hero" });
    }
  );

  // Product / feature images (limit to first 10 meaningful ones)
  $("img").each((_, el) => {
    if (images.length >= 12) return;
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (!src || src.startsWith("data:") || IMG_BLACKLIST.test(src)) return;
    const url = resolveUrl(src, baseUrl);
    if (seen.has(url)) return;
    // Skip tiny images (icons, spacers)
    const width = parseInt($(el).attr("width") || "0");
    const height = parseInt($(el).attr("height") || "0");
    if ((width > 0 && width < 50) || (height > 0 && height < 50)) return;
    const alt = $(el).attr("alt") || "";
    seen.add(url);
    images.push({ url, alt, context: "product" });
  });

  return images.slice(0, 12);
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
