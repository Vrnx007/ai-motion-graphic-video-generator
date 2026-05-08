/**
 * Scene Stitcher — Combines multiple scene code strings into one Remotion composition.
 * Runs client-side. Wraps each scene in a <Sequence> with correct timing.
 *
 * Includes validation: each scene is checked with Babel before inclusion.
 * Broken / truncated scenes are replaced with a safe placeholder.
 */

import * as Babel from "@babel/standalone";

export interface SceneCode {
  id: number;
  code: string;
  duration: number; // in seconds
}

/**
 * Validate a single scene code string.
 * Returns true if Babel can parse it without errors.
 */
function isValidJsx(code: string): boolean {
  try {
    Babel.transform(code, {
      presets: ["env", "react", "typescript"],
      filename: "scene-check.tsx",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a safe fallback component for a scene that failed validation.
 */
function fallbackScene(sceneName: string, label: string): string {
  // Escape any characters that could break the JSX string literal
  const safeLabel = label
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ")
    .slice(0, 80);
  return `const ${sceneName} = () => {
  return (
    <AbsoluteFill style={{background:'#FFFFFF',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'#1e293b',fontSize:36,fontWeight:'bold',textAlign:'center',padding:40}}>${safeLabel}</div>
    </AbsoluteFill>
  );
};`;
}

/**
 * Takes an array of generated scene code strings and produces
 * a single MyComposition component that plays them in sequence.
 *
 * Each scene is validated individually — broken scenes get a safe fallback
 * so one bad AI response can never crash the entire composition.
 */
export function stitchScenes(scenes: SceneCode[]): string {
  const fps = 30;
  let currentFrame = 0;

  // ── JSON (God Templates) engine ──
  const isJsonEngine =
    scenes.length > 0 && scenes[0].code.trim().startsWith("{");

  if (isJsonEngine) {
    const combinedJson = scenes
      .map((scene) => {
        const durationInFrames = scene.duration * fps;
        const fromFrame = currentFrame;
        currentFrame += durationInFrames;

        try {
          const parsed = JSON.parse(scene.code);
          return {
            ...parsed,
            durationInFrames,
            fromFrame,
          };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    return JSON.stringify({
      type: "template_sequence",
      sequences: combinedJson,
    });
  }

  // ── Legacy generative-code engine (Raw React / JSX) ──
  const sceneBlocks = scenes.map((scene, index) => {
    const durationInFrames = scene.duration * fps;
    const fromFrame = currentFrame;
    currentFrame += durationInFrames;

    const sceneName = `Scene${index + 1}`;

    // Rename MyComposition → SceneN
    let renamedCode = scene.code.replace(
      /const\s+MyComposition\s*=\s*\(\s*\)\s*=>\s*\{/,
      `const ${sceneName} = () => {`
    );

    // ── Validate with Babel ──
    if (!isValidJsx(renamedCode)) {
      console.warn(
        `[scene-stitcher] Scene ${scene.id} ("${sceneName}") failed Babel validation — using fallback.`
      );
      renamedCode = fallbackScene(sceneName, `Scene ${index + 1}`);
    }

    return {
      name: sceneName,
      code: renamedCode,
      from: fromFrame,
      duration: durationInFrames,
    };
  });

  // Build the stitched composition
  const allSceneCode = sceneBlocks.map((s) => s.code).join("\n\n");
  const sequenceBlocks = sceneBlocks
    .map(
      (s) =>
        `    <Sequence from={${s.from}} durationInFrames={${s.duration}}>
      <${s.name} />
    </Sequence>`
    )
    .join("\n");

  return `${allSceneCode}

const MyComposition = () => {
  return (
    <AbsoluteFill>
      <Audio src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" volume={0.5} />
${sequenceBlocks}
    </AbsoluteFill>
  );
};`;
}

/**
 * Repair already-stitched code that contains broken scenes.
 *
 * This is used by VideoPreview when it receives code from the database
 * (e.g. share pages) that was saved before the validation fix.
 *
 * Strategy: split the stitched blob on scene boundaries, validate each
 * individually, replace broken ones with fallback, and re-assemble.
 */
export function repairStitchedCode(code: string): string {
  // If the whole thing already parses, return as-is
  if (isValidJsx(code)) return code;

  // Split into individual Scene blocks + the final MyComposition wrapper.
  // Pattern: `const Scene1 = () => { ... };`
  // We look for `const Scene<N> = () =>` as boundaries.
  const sceneRegex =
    /const\s+(Scene\d+)\s*=\s*\(\s*\)\s*=>\s*\{/g;
  const boundaries: { name: string; start: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = sceneRegex.exec(code)) !== null) {
    boundaries.push({ name: match[1], start: match.index });
  }

  // Also find the final MyComposition wrapper
  const compositionMatch =
    /const\s+MyComposition\s*=\s*\(\s*\)\s*=>\s*\{/.exec(code);

  if (boundaries.length === 0 || !compositionMatch) {
    // Not a stitched multi-scene format — can't repair
    return code;
  }

  const compositionStart = compositionMatch.index;

  // Extract each scene's code substring
  const sceneChunks: { name: string; code: string }[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].start;
    const end =
      i + 1 < boundaries.length
        ? boundaries[i + 1].start
        : compositionStart;
    sceneChunks.push({
      name: boundaries[i].name,
      code: code.substring(start, end).trim(),
    });
  }

  // Validate each scene individually and repair if needed
  let anyRepaired = false;
  const repairedChunks = sceneChunks.map((chunk) => {
    if (isValidJsx(chunk.code)) {
      return chunk.code;
    }
    anyRepaired = true;
    console.warn(
      `[repairStitchedCode] ${chunk.name} is broken — replacing with fallback.`
    );
    return fallbackScene(chunk.name, chunk.name);
  });

  if (!anyRepaired) {
    // All individual scenes are fine but the wrapper is broken — just return as-is
    return code;
  }

  // Re-assemble: repaired scenes + original MyComposition wrapper
  const compositionWrapper = code.substring(compositionStart);
  const repaired = repairedChunks.join("\n\n") + "\n\n" + compositionWrapper;

  // Final sanity check
  if (isValidJsx(repaired)) {
    return repaired;
  }

  // If still broken, the wrapper itself is bad — return a minimal working composition
  console.warn(
    "[repairStitchedCode] Wrapper is also broken — building from scratch."
  );
  const sequenceBlocks = sceneChunks
    .map((chunk, i) => {
      const durationGuess = 5 * 30; // 5s default
      const from = i * durationGuess;
      return `    <Sequence from={${from}} durationInFrames={${durationGuess}}>
      <${chunk.name} />
    </Sequence>`;
    })
    .join("\n");

  return `${repairedChunks.join("\n\n")}

const MyComposition = () => {
  return (
    <AbsoluteFill>
      <Audio src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" volume={0.5} />
${sequenceBlocks}
    </AbsoluteFill>
  );
};`;
}

/**
 * Calculate total duration in frames from scene array
 */
export function getTotalFrames(
  scenes: Array<{ duration: number }>
): number {
  return scenes.reduce((total, scene) => total + scene.duration * 30, 0);
}
