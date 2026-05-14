/**
 * Scene Stitcher — Combines per-scene God-template JSON into one template_sequence.
 * JSON-only (no client-side eval / Babel).
 */

export interface SceneCode {
  id: number;
  code: string;
  duration: number;
}

export type StitchOptions = {
  musicSrc?: string;
};

function fallbackTemplateJson(label: string): Record<string, unknown> {
  const safe = String(label || "Scene").slice(0, 80);
  return {
    type: "template",
    templateName: "KineticHero",
    props: {
      headline: safe,
      subheadline: "Regenerate this scene",
      primaryColor: "#3B82F6",
      secondaryColor: "#7C3AED",
      backgroundColor: "#0F172A",
      textColor: "#FFFFFF",
      fontFamily: "Inter",
    },
  };
}

/**
 * Validates a single scene JSON string; returns parsed object or null.
 */
function parseSceneJson(code: string): Record<string, unknown> | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>;
    if (o.type === "template" && typeof o.templateName === "string") return o;
    return null;
  } catch {
    return null;
  }
}

/**
 * Takes an array of generated scene JSON strings and produces
 * a single template_sequence JSON string for VideoPreview.
 */
export function stitchScenes(scenes: SceneCode[], options?: StitchOptions): string {
  const fps = 30;
  let currentFrame = 0;

  const combinedJson = scenes.map((scene) => {
    const durationInFrames = Math.max(1, Math.round(scene.duration * fps));
    const fromFrame = currentFrame;
    currentFrame += durationInFrames;

    const parsed = parseSceneJson(scene.code);
    if (!parsed) {
      return {
        ...fallbackTemplateJson(`Scene ${scene.id}`),
        durationInFrames,
        fromFrame,
      };
    }

    return {
      ...parsed,
      durationInFrames,
      fromFrame,
    };
  });

  const out: Record<string, unknown> = {
    type: "template_sequence",
    sequences: combinedJson,
  };
  if (options?.musicSrc?.trim()) {
    out.musicSrc = options.musicSrc.trim();
  }
  return JSON.stringify(out);
}

/**
 * Legacy stitched JSX is no longer supported; return as-is for callers that still parse.
 */
export function repairStitchedCode(code: string): string {
  const t = code.trim();
  if (t.startsWith("{")) return code;
  return code;
}

export function getTotalFrames(scenes: Array<{ duration: number }>): number {
  return scenes.reduce((total, scene) => total + scene.duration * 30, 0);
}
