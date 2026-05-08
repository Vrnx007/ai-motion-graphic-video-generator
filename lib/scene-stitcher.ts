/**
 * Scene Stitcher — Combines multiple scene code strings into one Remotion composition.
 * Runs client-side. Wraps each scene in a <Sequence> with correct timing.
 */

export interface SceneCode {
  id: number;
  code: string;
  duration: number; // in seconds
}

/**
 * Takes an array of generated scene code strings and produces
 * a single MyComposition component that plays them in sequence.
 */
export function stitchScenes(scenes: SceneCode[]): string {
  const fps = 30;
  let currentFrame = 0;

  const sceneBlocks = scenes.map((scene, index) => {
    const durationInFrames = scene.duration * fps;
    const fromFrame = currentFrame;
    currentFrame += durationInFrames;

    // Extract the component body from "const MyComposition = () => { ... }"
    // We rename each to SceneN to avoid conflicts
    const sceneName = `Scene${index + 1}`;
    const renamedCode = scene.code.replace(
      /const\s+MyComposition\s*=\s*\(\s*\)\s*=>\s*\{/,
      `const ${sceneName} = () => {`
    );

    return {
      name: sceneName,
      code: renamedCode,
      from: fromFrame,
      duration: durationInFrames,
    };
  });

  const totalDuration = currentFrame;

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
 * Calculate total duration in frames from scene array
 */
export function getTotalFrames(scenes: Array<{ duration: number }>): number {
  return scenes.reduce((total, scene) => total + scene.duration * 30, 0);
}
