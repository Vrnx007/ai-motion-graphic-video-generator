import { SCREENSHOT_HEAVY_TEMPLATES } from "@/lib/god-template-validator";

export type SceneLike = {
  id?: number;
  title?: string;
  text?: string;
  visual?: string;
  duration: number;
  templateName?: string;
  type?: string;
  imageUrl?: string;
};

export type ScenePlanShape = {
  scenes: SceneLike[];
  totalDuration: number;
  musicMood?: string;
};

const TEMPLATE_NAMES = new Set([
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
]);

/** Typography / 3D / abstract — not screenshot-first */
const MOTION_FIRST_TEMPLATES = new Set([
  "KineticHero",
  "ProductOrbit3D",
  "StatCounter",
  "OrbFieldHero",
  "GlyphRhythm",
  "LogoReveal",
]);

export type PlanValidationIssue = { code: string; message: string };

const OPENING_TYPES = new Set(["hook", "intro"]);
const CLOSING_TYPES = new Set(["cta", "outro"]);

export function maxScreenshotHeavyScenes(sceneCount: number): number {
  if (sceneCount <= 0) return 0;
  return Math.max(1, Math.min(Math.ceil(sceneCount * 0.38), sceneCount - 1));
}

export function minMotionFirstScenes(sceneCount: number): number {
  if (sceneCount <= 0) return 0;
  return Math.max(2, Math.floor(sceneCount / 3));
}

export function validateScenePlan(
  plan: ScenePlanShape,
  expectedSceneCount: number,
  targetDuration: number,
  videoType?: string
): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];
  if (!plan.scenes || !Array.isArray(plan.scenes)) {
    issues.push({ code: "MISSING_SCENES", message: "scenes must be a non-empty array" });
    return issues;
  }
  if (plan.scenes.length !== expectedSceneCount) {
    issues.push({
      code: "SCENE_COUNT",
      message: `Expected ${expectedSceneCount} scenes, got ${plan.scenes.length}`,
    });
  }
  plan.scenes.forEach((sc, i) => {
    if (!sc.title?.trim()) issues.push({ code: "TITLE", message: `Scene ${i + 1}: missing title` });
    if (!sc.text?.trim()) issues.push({ code: "TEXT", message: `Scene ${i + 1}: missing text` });
    if (!sc.visual?.trim()) issues.push({ code: "VISUAL", message: `Scene ${i + 1}: missing visual` });
    const wordCount = (sc.text || "").trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 14) {
      issues.push({
        code: "TEXT_LENGTH",
        message: `Scene ${i + 1}: on-screen text must be ≤14 words (headline-style); got ${wordCount}`,
      });
    }
    const dur = Number(sc.duration);
    if (!Number.isFinite(dur) || dur < 2 || dur > 300) {
      issues.push({ code: "DURATION", message: `Scene ${i + 1}: duration ${sc.duration} out of range` });
    }
    if (sc.templateName && !TEMPLATE_NAMES.has(sc.templateName)) {
      issues.push({
        code: "TEMPLATE",
        message: `Scene ${i + 1}: unknown templateName "${sc.templateName}"`,
      });
    }
  });
  const sum = plan.scenes.reduce((s, sc) => s + (Number(sc.duration) || 0), 0);
  if (Math.abs(sum - targetDuration) > 2) {
    issues.push({
      code: "TOTAL",
      message: `Scene durations sum to ${sum}s but target is ${targetDuration}s`,
    });
  }

  const first = plan.scenes[0];
  const last = plan.scenes[plan.scenes.length - 1];
  if (first?.type && !OPENING_TYPES.has(String(first.type))) {
    issues.push({
      code: "NARRATIVE_OPEN",
      message: `Scene 1 type should be hook or intro for ${videoType || "general"}, got "${first.type}"`,
    });
  }
  if (last?.type && !CLOSING_TYPES.has(String(last.type))) {
    issues.push({
      code: "NARRATIVE_CLOSE",
      message: `Last scene type should be cta or outro, got "${last.type}"`,
    });
  }

  for (let i = 2; i < plan.scenes.length; i++) {
    const a = plan.scenes[i - 2]?.templateName;
    const b = plan.scenes[i - 1]?.templateName;
    const c = plan.scenes[i]?.templateName;
    if (a && a === b && b === c) {
      issues.push({
        code: "TEMPLATE_STREAK",
        message: `Template "${a}" used three times in a row — vary templates`,
      });
      break;
    }
  }

  const n = plan.scenes.length;
  if (n > 0) {
    let heavy = 0;
    let motionFirst = 0;
    for (const sc of plan.scenes) {
      const t = sc.templateName;
      if (t && SCREENSHOT_HEAVY_TEMPLATES.has(t)) heavy += 1;
      if (t && MOTION_FIRST_TEMPLATES.has(t)) motionFirst += 1;
    }
    const maxHeavy = maxScreenshotHeavyScenes(n);
    if (heavy > maxHeavy) {
      issues.push({
        code: "SCREENSHOT_BUDGET",
        message: `At most ${maxHeavy} scene(s) may use FeatureShowcase or DemoBrowserWalkthrough; found ${heavy}. Use OrbFieldHero, GlyphRhythm, ProductOrbit3D, KineticHero, StatCounter, etc.`,
      });
    }
    const needMotion = minMotionFirstScenes(n);
    if (motionFirst < needMotion) {
      issues.push({
        code: "MOTION_BUDGET",
        message: `At least ${needMotion} scene(s) must use motion-first templates (KineticHero, ProductOrbit3D, StatCounter, OrbFieldHero, GlyphRhythm, LogoReveal); found ${motionFirst}.`,
      });
    }
  }

  return issues;
}
