/** ElevenLabs per-scene voiceover — wire `ELEVENLABS_API_KEY` + `voiceId`. */
export async function synthesizeSceneVoiceover(_input: {
  text: string;
  voiceId: string;
  sceneId: string;
}): Promise<{ audioUrl: string; durationSec: number }> {
  void _input;
  return { audioUrl: "", durationSec: 0 };
}
