/**
 * Color utilities for brand extraction.
 * Handles normalization of CSS colors (#RGB, rgb(), hsl(), named)
 * and palette extraction from images via sharp.
 */

// All 147 CSS named colors → hex
const CSS_NAMED_COLORS: Record<string, string> = {
  aliceblue: "#F0F8FF", antiquewhite: "#FAEBD7", aqua: "#00FFFF", aquamarine: "#7FFFD4",
  azure: "#F0FFFF", beige: "#F5F5DC", bisque: "#FFE4C4", black: "#000000",
  blanchedalmond: "#FFEBCD", blue: "#0000FF", blueviolet: "#8A2BE2", brown: "#A52A2A",
  burlywood: "#DEB887", cadetblue: "#5F9EA0", chartreuse: "#7FFF00", chocolate: "#D2691E",
  coral: "#FF7F50", cornflowerblue: "#6495ED", cornsilk: "#FFF8DC", crimson: "#DC143C",
  cyan: "#00FFFF", darkblue: "#00008B", darkcyan: "#008B8B", darkgoldenrod: "#B8860B",
  darkgray: "#A9A9A9", darkgreen: "#006400", darkgrey: "#A9A9A9", darkkhaki: "#BDB76B",
  darkmagenta: "#8B008B", darkolivegreen: "#556B2F", darkorange: "#FF8C00", darkorchid: "#9932CC",
  darkred: "#8B0000", darksalmon: "#E9967A", darkseagreen: "#8FBC8F", darkslateblue: "#483D8B",
  darkslategray: "#2F4F4F", darkslategrey: "#2F4F4F", darkturquoise: "#00CED1", darkviolet: "#9400D3",
  deeppink: "#FF1493", deepskyblue: "#00BFFF", dimgray: "#696969", dimgrey: "#696969",
  dodgerblue: "#1E90FF", firebrick: "#B22222", floralwhite: "#FFFAF0", forestgreen: "#228B22",
  fuchsia: "#FF00FF", gainsboro: "#DCDCDC", ghostwhite: "#F8F8FF", gold: "#FFD700",
  goldenrod: "#DAA520", gray: "#808080", green: "#008000", greenyellow: "#ADFF2F",
  grey: "#808080", honeydew: "#F0FFF0", hotpink: "#FF69B4", indianred: "#CD5C5C",
  indigo: "#4B0082", ivory: "#FFFFF0", khaki: "#F0E68C", lavender: "#E6E6FA",
  lavenderblush: "#FFF0F5", lawngreen: "#7CFC00", lemonchiffon: "#FFFACD", lightblue: "#ADD8E6",
  lightcoral: "#F08080", lightcyan: "#E0FFFF", lightgoldenrodyellow: "#FAFAD2", lightgray: "#D3D3D3",
  lightgreen: "#90EE90", lightgrey: "#D3D3D3", lightpink: "#FFB6C1", lightsalmon: "#FFA07A",
  lightseagreen: "#20B2AA", lightskyblue: "#87CEFA", lightslategray: "#778899", lightslategrey: "#778899",
  lightsteelblue: "#B0C4DE", lightyellow: "#FFFFE0", lime: "#00FF00", limegreen: "#32CD32",
  linen: "#FAF0E6", magenta: "#FF00FF", maroon: "#800000", mediumaquamarine: "#66CDAA",
  mediumblue: "#0000CD", mediumorchid: "#BA55D3", mediumpurple: "#9370DB", mediumseagreen: "#3CB371",
  mediumslateblue: "#7B68EE", mediumspringgreen: "#00FA9A", mediumturquoise: "#48D1CC",
  mediumvioletred: "#C71585", midnightblue: "#191970", mintcream: "#F5FFFA", mistyrose: "#FFE4E1",
  moccasin: "#FFE4B5", navajowhite: "#FFDEAD", navy: "#000080", oldlace: "#FDF5E6",
  olive: "#808000", olivedrab: "#6B8E23", orange: "#FFA500", orangered: "#FF4500",
  orchid: "#DA70D6", palegoldenrod: "#EEE8AA", palegreen: "#98FB98", paleturquoise: "#AFEEEE",
  palevioletred: "#DB7093", papayawhip: "#FFEFD5", peachpuff: "#FFDAB9", peru: "#CD853F",
  pink: "#FFC0CB", plum: "#DDA0DD", powderblue: "#B0E0E6", purple: "#800080",
  rebeccapurple: "#663399", red: "#FF0000", rosybrown: "#BC8F8F", royalblue: "#4169E1",
  saddlebrown: "#8B4513", salmon: "#FA8072", sandybrown: "#F4A460", seagreen: "#2E8B57",
  seashell: "#FFF5EE", sienna: "#A0522D", silver: "#C0C0C0", skyblue: "#87CEEB",
  slateblue: "#6A5ACD", slategray: "#708090", slategrey: "#708090", snow: "#FFFAFA",
  springgreen: "#00FF7F", steelblue: "#4682B4", tan: "#D2B48C", teal: "#008080",
  thistle: "#D8BFD8", tomato: "#FF6347", turquoise: "#40E0D0", violet: "#EE82EE",
  wheat: "#F5DEB3", white: "#FFFFFF", whitesmoke: "#F5F5F5", yellow: "#FFFF00",
  yellowgreen: "#9ACD32",
};

/** Convert HSL values (h: 0-360, s: 0-100, l: 0-100) to hex */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/** Parse any CSS color string to uppercase #RRGGBB. Returns null if unparseable. */
export function normalizeColor(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();

  // #RGB or #RRGGBB or #RRGGBBAA
  if (s.startsWith("#")) {
    const hex = s.slice(1).replace(/[^0-9a-f]/g, "");
    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
    }
    if (hex.length === 6 || hex.length === 8) {
      return `#${hex.slice(0, 6)}`.toUpperCase();
    }
    return null;
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `#${Number(r).toString(16).padStart(2, "0")}${Number(g).toString(16).padStart(2, "0")}${Number(b).toString(16).padStart(2, "0")}`.toUpperCase();
  }

  // hsl(h, s%, l%) or hsla(h, s%, l%, a)
  const hslMatch = s.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
  if (hslMatch) {
    return hslToHex(Number(hslMatch[1]), Number(hslMatch[2]), Number(hslMatch[3]));
  }

  // Named color
  if (CSS_NAMED_COLORS[s]) return CSS_NAMED_COLORS[s];

  return null;
}

/** Check if an RGB triplet is near-white (all > 230) */
export function isNearWhite(r: number, g: number, b: number): boolean {
  return r > 230 && g > 230 && b > 230;
}

/** Check if an RGB triplet is near-black (all < 25) */
export function isNearBlack(r: number, g: number, b: number): boolean {
  return r < 25 && g < 25 && b < 25;
}

/** Check if an RGB triplet is a muted gray (low saturation, mid brightness) */
export function isMutedGray(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return true;
  const saturation = (max - min) / max;
  const brightness = (r + g + b) / 3;
  return saturation < 0.08 && brightness > 50 && brightness < 200;
}

/** Euclidean distance between two RGB colors */
export function euclideanDistance(
  c1: [number, number, number],
  c2: [number, number, number]
): number {
  return Math.sqrt(
    (c1[0] - c2[0]) ** 2 +
    (c1[1] - c2[1]) ** 2 +
    (c1[2] - c2[2]) ** 2
  );
}

/** Parse hex string to [r, g, b] */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** Calculate saturation of an RGB color (0-1) */
export function rgbSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** Find the first usable (non-white, non-black) color from an array of hex colors */
export function findFirstUsableColor(colors: string[]): string | null {
  for (const hex of colors) {
    const [r, g, b] = hexToRgb(hex);
    if (!isNearWhite(r, g, b) && !isNearBlack(r, g, b)) return hex;
  }
  return null;
}

/** Pick the most saturated non-extreme color as the primary accent */
export function pickBestAccent(palette: string[]): string | null {
  let best: string | null = null;
  let bestSat = -1;
  for (const hex of palette) {
    const [r, g, b] = hexToRgb(hex);
    if (isNearWhite(r, g, b) || isNearBlack(r, g, b)) continue;
    const sat = rgbSaturation(r, g, b);
    if (sat > bestSat) {
      bestSat = sat;
      best = hex;
    }
  }
  return best;
}

/** Merge brand color into palette, deduped + distinct, max entries */
export function mergeBrandPalette(
  brandColor: string | null,
  logoPalette: string[],
  max = 8
): string[] {
  const result: string[] = [];
  const all = brandColor ? [brandColor, ...logoPalette] : logoPalette;

  for (const hex of all) {
    if (result.length >= max) break;
    const rgb = hexToRgb(hex);
    const tooClose = result.some(
      (existing) => euclideanDistance(rgb, hexToRgb(existing)) < 80
    );
    if (!tooClose) result.push(hex);
  }
  return result;
}
