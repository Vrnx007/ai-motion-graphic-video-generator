import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { logApiError } from "@/lib/server-log";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Default ElevenLabs voices that have free-tier permissive licensing.
 * Users can override with their own voice ids by passing voiceId.
 */
const DEFAULT_VOICES: Record<string, { id: string; label: string }> = {
  rachel: { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel — calm, warm female" },
  adam: { id: "pNInz6obpgDQGcFmaJgB", label: "Adam — deep, narrator male" },
  bella: { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella — youthful, friendly female" },
  antoni: { id: "ErXwobaYiN019PkySvjV", label: "Antoni — confident male" },
  domi: { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi — bold female" },
  arnold: { id: "VR6AewLTigWG4xSOukaG", label: "Arnold — strong male" },
};

type VoiceoverRequestBody = {
  text?: string;
  voice?: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "AI voiceover not configured. Add ELEVENLABS_API_KEY to your environment to enable it.",
          configurationRequired: true,
        },
        { status: 503 }
      );
    }

    let body: VoiceoverRequestBody;
    try {
      body = (await req.json()) as VoiceoverRequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const text = (body.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (text.length > 2500) {
      return NextResponse.json(
        { error: "text too long (max 2500 chars per scene)" },
        { status: 400 }
      );
    }

    const voiceKey = String(body.voice || "rachel").toLowerCase();
    const voiceId =
      body.voiceId?.trim() ||
      DEFAULT_VOICES[voiceKey]?.id ||
      DEFAULT_VOICES.rachel.id;

    const modelId = body.modelId || "eleven_turbo_v2_5";
    const stability =
      typeof body.stability === "number" && body.stability >= 0 && body.stability <= 1
        ? body.stability
        : 0.5;
    const similarityBoost =
      typeof body.similarityBoost === "number" &&
      body.similarityBoost >= 0 &&
      body.similarityBoost <= 1
        ? body.similarityBoost
        : 0.75;

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?optimize_streaming_latency=0&output_format=mp3_44100_128`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: { stability, similarity_boost: similarityBoost, style: 0.15, use_speaker_boost: true },
      }),
      signal: controller.signal,
    }).catch((e: unknown) => {
      throw e instanceof Error ? e : new Error("ElevenLabs request failed");
    });
    clearTimeout(timer);

    if (!resp.ok) {
      let detail = "";
      try {
        detail = await resp.text();
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        {
          error: `ElevenLabs returned ${resp.status}`,
          detail: detail.slice(0, 400),
        },
        { status: 502 }
      );
    }

    const audioBuffer = await resp.arrayBuffer();
    if (audioBuffer.byteLength < 200) {
      return NextResponse.json({ error: "Empty audio from ElevenLabs" }, { status: 502 });
    }

    const base64 = Buffer.from(audioBuffer).toString("base64");
    const audioUrl = `data:audio/mpeg;base64,${base64}`;
    return NextResponse.json({
      audioUrl,
      bytes: audioBuffer.byteLength,
      voice: voiceKey,
      voiceId,
    });
  } catch (error: unknown) {
    logApiError("voiceover", error);
    const message = error instanceof Error ? error.message : "Voiceover failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    available: Object.entries(DEFAULT_VOICES).map(([key, v]) => ({
      key,
      label: v.label,
    })),
    configured: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
  });
}
