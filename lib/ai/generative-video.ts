/** SadTalker / HeyGen / LTX-2 / FLUX2 integration stubs. */
export async function generateAvatarClip(_input: { imageUrl: string; audioUrl: string }): Promise<{ mp4Url: string }> {
  void _input;
  return { mp4Url: "" };
}

export async function generateLtxBroll(_prompt: string): Promise<{ mp4Url: string }> {
  void _prompt;
  return { mp4Url: "" };
}

export async function generateFluxImage(_prompt: string): Promise<{ imageUrl: string }> {
  void _prompt;
  return { imageUrl: "" };
}
