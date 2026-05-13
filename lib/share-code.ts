/**
 * Inject shareToken into image-proxy URLs so public share viewers can load images without a session.
 */
export function injectShareTokenInVideoCode(code: string, shareToken: string): string {
  const enc = encodeURIComponent(shareToken);
  const inject = `shareToken=${enc}&`;
  return code.replaceAll("/api/image-proxy?url=", `/api/image-proxy?${inject}url=`);
}
