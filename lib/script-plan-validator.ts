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
]);

export type PlanValidationIssue = { code: string; message: string };

export function validateScenePlan(
  plan: ScenePlanShape,
  expectedSceneCount: number,
  targetDuration: number
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
  return issues;
}
