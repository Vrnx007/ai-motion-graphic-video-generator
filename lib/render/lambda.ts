/**
 * Remotion Lambda invocation — wire `REMOTION_FUNCTION_NAME`, `REMOTION_SERVE_URL`, etc.
 * @see https://www.remotion.dev/docs/lambda
 */
export type LambdaRenderInput = {
  serveUrl: string;
  composition: string;
  inputProps: Record<string, unknown>;
  codec?: "h264" | "h265";
  crf?: number;
  pixelFormat?: string;
  outName?: string;
};

export async function invokeRemotionLambda(_input: LambdaRenderInput): Promise<{ renderId?: string; error?: string }> {
  const fn = process.env.REMOTION_FUNCTION_NAME?.trim();
  if (!fn) {
    return { error: "REMOTION_FUNCTION_NAME not configured" };
  }
  // Integration point: @remotion/lambda client renderMediaOnLambda(...)
  return { renderId: undefined, error: "Lambda client not wired in this build — use REMOTION_RENDER_WEBHOOK_URL worker." };
}
