import { NextResponse } from "next/server";

// Server-side rendering with @remotion/renderer requires headless Chromium
// which is NOT supported on Vercel serverless functions.
// Download is handled client-side via MediaRecorder in the browser instead.

export async function POST() {
  return NextResponse.json(
    { error: "Server-side rendering is not available. Use client-side recording." },
    { status: 501 }
  );
}