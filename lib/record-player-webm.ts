/**
 * Records the visible Remotion canvas/video from the DOM into a WebM using MediaRecorder.
 * Used when server-side Remotion render is unavailable (e.g. Vercel serverless).
 */
export async function recordRemotionPreviewToWebm(options: {
  durationSec: number;
  /** Called with 0–100 while recording */
  onProgress?: (pct: number) => void;
  /** Wait before capture so the first frame is ready */
  warmupMs?: number;
}): Promise<Blob> {
  const { durationSec, onProgress, warmupMs = 500 } = options;
  await new Promise((r) => setTimeout(r, warmupMs));

  const playerEl = document.querySelector("[data-remotion-player='true']");
  const videoEl = playerEl?.querySelector("video") as HTMLVideoElement | null;
  const canvasEl = playerEl?.querySelector("canvas") as HTMLCanvasElement | null;
  let stream: MediaStream | null = null;
  if (videoEl && (videoEl as any).captureStream) stream = (videoEl as any).captureStream(30);
  else if (canvasEl && (canvasEl as any).captureStream) stream = (canvasEl as any).captureStream(30);
  if (!stream) {
    throw new Error("Could not capture stream. Open the preview and try again.");
  }

  const mimeType =
    ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) =>
      MediaRecorder.isTypeSupported(m)
    ) ?? "video/webm";

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const totalMs = Math.max(3000, durationSec * 1000);
  const startTime = Date.now();
  const prog = setInterval(() => {
    onProgress?.(Math.min(95, Math.round(((Date.now() - startTime) / totalMs) * 100)));
  }, 200);

  recorder.start(100);

  await new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = (e) => reject(e);
    setTimeout(() => {
      recorder.stop();
      clearInterval(prog);
    }, totalMs + 800);
  });

  onProgress?.(100);
  return new Blob(chunks, { type: mimeType });
}

export function projectDurationSeconds(project: {
  duration?: number;
  scenes?: unknown;
}): number {
  const scenes = project.scenes;
  if (Array.isArray(scenes) && scenes.length > 0) {
    const sum = scenes.reduce((s: number, sc: any) => s + (Number(sc?.duration) || 0), 0);
    if (sum > 0) return sum;
  }
  return Math.max(3, Math.min(300, Number(project.duration) || 10));
}
