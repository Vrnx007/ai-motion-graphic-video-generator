import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { logApiError } from "@/lib/server-log";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI Avatar (talking head) generation. We currently support 3 providers:
 *  - HeyGen   (HEYGEN_API_KEY)            — cloud, recommended
 *  - D-ID     (DID_API_KEY)               — cloud
 *  - SadTalker (SADTALKER_ENDPOINT_URL)   — self-hosted RunPod / Modal
 *
 * The endpoint returns honest status so the UI can show a Beta badge instead of pretending.
 */

type AvatarRequestBody = {
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  voiceId?: string;
  provider?: "heygen" | "did" | "sadtalker" | "auto";
};

function configuredProviders(): Array<"heygen" | "did" | "sadtalker"> {
  const out: Array<"heygen" | "did" | "sadtalker"> = [];
  if (process.env.HEYGEN_API_KEY?.trim()) out.push("heygen");
  if (process.env.DID_API_KEY?.trim()) out.push("did");
  if (process.env.SADTALKER_ENDPOINT_URL?.trim()) out.push("sadtalker");
  return out;
}

export async function GET() {
  const providers = configuredProviders();
  return NextResponse.json({
    configured: providers.length > 0,
    providers,
    beta: true,
    message:
      providers.length > 0
        ? `Avatar enabled via: ${providers.join(", ")}`
        : "AI Avatar is in beta. Add HEYGEN_API_KEY, DID_API_KEY, or SADTALKER_ENDPOINT_URL to enable.",
  });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: AvatarRequestBody;
    try {
      body = (await req.json()) as AvatarRequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const providers = configuredProviders();
    if (providers.length === 0) {
      return NextResponse.json(
        {
          error:
            "AI Avatar not configured. Set HEYGEN_API_KEY, DID_API_KEY, or SADTALKER_ENDPOINT_URL.",
          configurationRequired: true,
          beta: true,
        },
        { status: 503 }
      );
    }

    // Pick first available
    const provider =
      body.provider && providers.includes(body.provider as never)
        ? body.provider
        : providers[0];

    if (provider === "heygen") {
      const apiKey = process.env.HEYGEN_API_KEY!.trim();
      const text = (body.text || "").trim();
      if (!text) {
        return NextResponse.json({ error: "text required for HeyGen" }, { status: 400 });
      }
      const r = await fetch("https://api.heygen.com/v2/video/generate", {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          video_inputs: [
            {
              character: { type: "avatar", avatar_id: "Daisy-inskirt-20220818" },
              voice: { type: "text", input_text: text },
            },
          ],
          test: false,
          aspect_ratio: "16:9",
        }),
      });
      if (!r.ok) {
        return NextResponse.json(
          { error: `HeyGen returned ${r.status}` },
          { status: 502 }
        );
      }
      const data = (await r.json()) as { data?: { video_id?: string } };
      return NextResponse.json({
        provider: "heygen",
        videoId: data?.data?.video_id || null,
        pending: true,
        message:
          "Avatar render queued at HeyGen. Poll their /v1/video_status.get?video_id=... endpoint with your key.",
      });
    }

    if (provider === "did") {
      const apiKey = process.env.DID_API_KEY!.trim();
      const text = (body.text || "").trim();
      const sourceImage =
        body.imageUrl?.trim() ||
        "https://create-images-results.d-id.com/DefaultPresenters/Emma_f/image.jpeg";
      const r = await fetch("https://api.d-id.com/talks", {
        method: "POST",
        headers: {
          Authorization: `Basic ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_url: sourceImage,
          script: { type: "text", input: text },
        }),
      });
      if (!r.ok) {
        return NextResponse.json(
          { error: `D-ID returned ${r.status}` },
          { status: 502 }
        );
      }
      const data = (await r.json()) as { id?: string };
      return NextResponse.json({
        provider: "did",
        talkId: data?.id || null,
        pending: true,
        message: "Avatar render queued at D-ID.",
      });
    }

    if (provider === "sadtalker") {
      const endpoint = process.env.SADTALKER_ENDPOINT_URL!.trim();
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: body.imageUrl,
          audio_url: body.audioUrl,
        }),
      });
      if (!r.ok) {
        return NextResponse.json(
          { error: `SadTalker endpoint returned ${r.status}` },
          { status: 502 }
        );
      }
      const data = (await r.json()) as { mp4_url?: string };
      return NextResponse.json({
        provider: "sadtalker",
        videoUrl: data?.mp4_url || null,
        pending: false,
      });
    }

    return NextResponse.json({ error: "No provider matched" }, { status: 500 });
  } catch (error: unknown) {
    logApiError("avatar", error);
    const message = error instanceof Error ? error.message : "Avatar failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
