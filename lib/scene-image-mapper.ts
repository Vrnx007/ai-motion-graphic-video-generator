/**
 * Deterministically assign curated brand images to scenes that benefit from a screenshot.
 *
 * The LLM is told to do this, but it routinely skips images on demo / solution / features
 * scenes when it can. This helper is run AFTER /api/generate-script returns the plan so
 * we always wire visual proof into the right scenes.
 */

import type { Scene } from "@/components/SceneTimeline";

type BrandImage = { url: string; alt?: string; context?: string };

/** Scene types where a curated UI screenshot strongly improves the visual. */
const SCREENSHOT_FRIENDLY_TYPES = new Set([
  "demo",
  "solution",
  "features",
  "problem",
  "comparison",
  "hook",
  "intro",
]);

/** Templates that natively use a single imageUrl prop. */
const SINGLE_IMAGE_TEMPLATES = new Set([
  "FeatureShowcase",
  "SplitScreen",
  "DemoBrowserWalkthrough",
  "ComparisonSplit",
  "TestimonialSpotlight",
  "LogoReveal",
]);

/** Pick a template that fits a scene type if the AI didn't choose one for an imageUrl. */
function preferredImageTemplate(type: string): string {
  switch (type) {
    case "demo":
      return "DemoBrowserWalkthrough";
    case "comparison":
      return "ComparisonSplit";
    case "problem":
      return "SplitScreen";
    case "solution":
    case "features":
      return "FeatureShowcase";
    default:
      return "FeatureShowcase";
  }
}

/**
 * Round-robin assign brand images to scenes whose type benefits from a screenshot
 * AND whose templateName accepts a single imageUrl. Leaves AI-set imageUrl alone.
 */
export function assignBrandImagesToScenes(scenes: Scene[], images: BrandImage[]): Scene[] {
  if (!Array.isArray(scenes) || scenes.length === 0) return scenes;
  if (!Array.isArray(images) || images.length === 0) return scenes;

  // Skip the very first scene (hook) and last scene (cta/outro) by default — they read better as
  // pure motion. But if every screenshot-friendly scene has been used we'll still wrap around.
  const usableImages = images
    .filter((img) => typeof img?.url === "string" && img.url.startsWith("http"))
    .slice(0, 12);
  if (usableImages.length === 0) return scenes;

  let cursor = 0;
  return scenes.map((scene, idx) => {
    if (scene.imageUrl) return scene; // AI already attached a curated image — respect it

    const wantsImage = SCREENSHOT_FRIENDLY_TYPES.has(String(scene.type || ""));
    if (!wantsImage) return scene;

    // Skip the absolute first scene unless we have >=3 images (let the opener breathe)
    if (idx === 0 && usableImages.length < 3) return scene;

    const img = usableImages[cursor % usableImages.length];
    cursor += 1;

    // If AI picked a template that doesn't accept imageUrl, switch to a screenshot-friendly one
    const tmpl =
      scene.templateName && SINGLE_IMAGE_TEMPLATES.has(scene.templateName)
        ? scene.templateName
        : preferredImageTemplate(String(scene.type || ""));

    return {
      ...scene,
      imageUrl: img.url,
      templateName: tmpl,
    };
  });
}
