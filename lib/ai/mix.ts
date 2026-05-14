/** ffmpeg / wasm mux — stub for Lambda render step. */
export async function mixMasterAudio(_input: {
  voiceUrl: string;
  musicUrl: string;
  sfxUrls?: string[];
}): Promise<{ masterUrl: string }> {
  void _input;
  return { masterUrl: "" };
}
