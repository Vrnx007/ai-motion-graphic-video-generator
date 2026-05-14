/** Templates that strongly imply a product / UI screenshot as the hero. */
export const SCREENSHOT_HEAVY_TEMPLATES = new Set([
  "FeatureShowcase",
  "DemoBrowserWalkthrough",
]);

const ALLOW_FEATURE_SHOWCASE_TYPES = new Set(["demo", "solution", "features"]);

const KNOWN_TEMPLATES = new Set([
  "KineticHero",
  "BentoGrid",
  "FeatureShowcase",
  "SplitScreen",
  "StatCounter",
  "LogoReveal",
  "ProductOrbit3D",
  "DemoBrowserWalkthrough",
  "LottieOverlay",
  "IntegrationShowcase",
  "TestimonialSpotlight",
  "ComparisonSplit",
  "OrbFieldHero",
  "GlyphRhythm",
  "ParticleStorm",
  "MorphHeadline",
]);

export type SceneTypeHint = { type?: string; templateName?: string };

export function validateGodTemplatePayload(
  parsed: unknown,
  scene?: SceneTypeHint
): string[] {
  const errors: string[] = [];
  if (!parsed || typeof parsed !== "object") {
    errors.push("Payload must be a JSON object");
    return errors;
  }
  const o = parsed as Record<string, unknown>;
  if (o.type !== "template") {
    errors.push('type must be "template"');
  }
  const name = typeof o.templateName === "string" ? o.templateName.trim() : "";
  if (!name || !KNOWN_TEMPLATES.has(name)) {
    errors.push(`Unknown or missing templateName: "${name}"`);
    return errors;
  }
  const props = o.props;
  if (!props || typeof props !== "object") {
    errors.push("props must be an object");
    return errors;
  }
  const p = props as Record<string, unknown>;

  const st = scene?.type ? String(scene.type) : "";
  const forced = scene?.templateName === "FeatureShowcase";
  if (
    name === "FeatureShowcase" &&
    st &&
    !ALLOW_FEATURE_SHOWCASE_TYPES.has(st) &&
    !forced
  ) {
    errors.push(
      `FeatureShowcase is only for demo/solution/features scenes; this scene type is "${st}". Use ProductOrbit3D, KineticHero, OrbFieldHero, GlyphRhythm, StatCounter, or SplitScreen with optional small imageUrl.`
    );
  }

  if (name === "FeatureShowcase") {
    const img = p.imageUrl;
    if (typeof img !== "string" || !img.trim()) {
      errors.push("FeatureShowcase requires props.imageUrl (non-empty string)");
    }
  }

  if (name === "DemoBrowserWalkthrough") {
    const img = p.imageUrl;
    if (typeof img !== "string" || !img.trim()) {
      errors.push("DemoBrowserWalkthrough requires props.imageUrl");
    }
  }

  if (name === "KineticHero") {
    const h = p.headline;
    if (typeof h !== "string" || !h.trim()) {
      errors.push("KineticHero requires props.headline");
    }
  }

  if (name === "StatCounter") {
    const stats = p.stats;
    if (!Array.isArray(stats) || stats.length === 0) {
      errors.push("StatCounter requires props.stats as a non-empty array");
    }
  }

  if (name === "LottieOverlay") {
    if (!p.animationData || typeof p.animationData !== "object") {
      errors.push("LottieOverlay requires props.animationData object");
    }
  }

  if (name === "BentoGrid") {
    const feats = p.features;
    if (!Array.isArray(feats) || feats.length < 2) {
      errors.push("BentoGrid requires props.features array with at least 2 short labels");
    }
  }

  if (
    name === "OrbFieldHero" ||
    name === "GlyphRhythm" ||
    name === "ParticleStorm" ||
    name === "MorphHeadline"
  ) {
    const h = p.headline;
    if (typeof h !== "string" || !h.trim()) {
      errors.push(`${name} requires props.headline`);
    }
  }

  return errors;
}

/** Client-safe shallow check: valid JSON + known template + props object. */
export function isValidGodTemplateJsonString(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.type !== "template") return false;
    const name = typeof parsed.templateName === "string" ? parsed.templateName.trim() : "";
    if (!KNOWN_TEMPLATES.has(name)) return false;
    if (!parsed.props || typeof parsed.props !== "object") return false;
    return true;
  } catch {
    return false;
  }
}
