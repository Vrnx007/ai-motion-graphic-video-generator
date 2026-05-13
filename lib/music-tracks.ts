/**
 * Maps script planner `musicMood` to a stable background URL for Remotion <Audio />.
 * Keep URLs HTTPS and publicly reachable for preview + future headless render.
 */
const TRACKS = {
  cinematic: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  upbeat: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  tech: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  calm: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
} as const;

const DEFAULT = TRACKS.upbeat;

export function resolveBackgroundTrack(mood: string | null | undefined): string {
  const m = (mood || "").toLowerCase();
  if (!m) return DEFAULT;
  if (/(cinematic|dramatic|slow|film|epic)/.test(m)) return TRACKS.cinematic;
  if (/(tech|digital|future|electronic|synth|cyber)/.test(m)) return TRACKS.tech;
  if (/(calm|ambient|soft|minimal|lo-?fi|chill)/.test(m)) return TRACKS.calm;
  if (/(upbeat|energetic|happy|fast|pop|bounce)/.test(m)) return TRACKS.upbeat;
  return DEFAULT;
}
