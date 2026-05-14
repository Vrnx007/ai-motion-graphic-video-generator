/** Port of toolkit sync_timing: align scene durations to VO + padding (seconds). */
export function syncSceneDurationsToAudio(
  scenes: Array<{ id: number; duration: number }>,
  audioDurationsSec: Record<number, number>,
  paddingSec = 1
): Array<{ id: number; duration: number }> {
  return scenes.map((s) => {
    const a = audioDurationsSec[s.id];
    if (typeof a !== "number" || !Number.isFinite(a)) return s;
    return { ...s, duration: Math.max(3, Math.round(a + paddingSec)) };
  });
}
