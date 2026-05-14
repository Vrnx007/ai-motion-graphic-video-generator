export const VISUAL_LANGUAGES = [
  "apple_clean",
  "stripe_density",
  "linear_devtool",
  "vercel_brutal",
  "glass_orb",
] as const;

export type VisualLanguageId = (typeof VISUAL_LANGUAGES)[number];

const ROUTER: Record<string, VisualLanguageId> = {
  fintech: "stripe_density",
  finance: "stripe_density",
  devtool: "linear_devtool",
  developer: "linear_devtool",
  saas: "vercel_brutal",
  default: "glass_orb",
};

export function pickVisualLanguage(industry: string): VisualLanguageId {
  const k = industry.toLowerCase();
  for (const [needle, lang] of Object.entries(ROUTER)) {
    if (k.includes(needle)) return lang;
  }
  return ROUTER.default;
}
