"use client";
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import * as Remotion from "remotion";
import { TemplateRegistry } from "./templates/TemplateRegistry";
import { Monitor, Cpu, Play, Pause } from "lucide-react";

export type VideoPreviewVariant = "editor" | "clean";

export type VideoPreviewHandle = {
  play: () => void;
  pause: () => void;
  seekToStart: () => void;
  seekToFrame: (frame: number) => void;
};

const DEFAULT_BG_MUSIC =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

type VideoPreviewProps = {
  code: string;
  duration?: number;
  aspectRatio?: string;
  variant?: VideoPreviewVariant;
  musicSrc?: string | null;
};

function parseComposition(code: string, bgTrack: string): {
  Component: React.ComponentType | null;
  error: string | null;
} {
  const cleanCode = code
    .replace(/^```(?:json|jsx?|tsx?)?\s*\n?/gim, "")
    .replace(/\n?```\s*$/gim, "")
    .trim();

  if (!cleanCode.startsWith("{")) {
    return {
      Component: null,
      error:
        "Legacy JSX compositions are no longer supported. Regenerate this project (God templates / JSON only).",
    };
  }

  try {
    const parsed = JSON.parse(cleanCode) as Record<string, unknown>;

    if (parsed.type === "template" && typeof parsed.templateName === "string") {
      const Comp = () => (
        <TemplateRegistry
          templateName={parsed.templateName as string}
          props={(parsed.props as Record<string, unknown>) || {}}
        />
      );
      return { Component: Comp, error: null };
    }

    if (parsed.type === "template_sequence" && Array.isArray(parsed.sequences)) {
      const track =
        (typeof parsed.musicSrc === "string" && parsed.musicSrc.trim()) || bgTrack;
      const duckMusic = Boolean(parsed.duckMusicForVoiceover);
      const { AbsoluteFill, Audio, Sequence } = Remotion;
      const sequences = parsed.sequences as Array<{
        fromFrame?: number;
        durationInFrames?: number;
        templateName?: string;
        props?: Record<string, unknown>;
        voiceoverUrl?: string;
      }>;
      const hasAnyVO = sequences.some((s) => typeof s.voiceoverUrl === "string" && s.voiceoverUrl);
      const musicVolume = duckMusic && hasAnyVO ? 0.12 : 0.35;
      const Comp = () => (
        <AbsoluteFill style={{ backgroundColor: "#000" }}>
          <Audio src={track} volume={musicVolume} />
          {sequences.map((seq, i) => {
            const from = Number(seq.fromFrame) || 0;
            const dur = Math.max(1, Number(seq.durationInFrames) || 1);
            return (
              <React.Fragment key={i}>
                <Sequence from={from} durationInFrames={dur}>
                  <TemplateRegistry
                    templateName={String(seq.templateName || "KineticHero")}
                    props={seq.props || {}}
                  />
                </Sequence>
                {seq.voiceoverUrl ? (
                  <Sequence from={from} durationInFrames={dur}>
                    <Audio src={seq.voiceoverUrl} volume={1} />
                  </Sequence>
                ) : null}
              </React.Fragment>
            );
          })}
        </AbsoluteFill>
      );
      return { Component: Comp, error: null };
    }

    return { Component: null, error: "Invalid JSON composition: expected type template or template_sequence." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid JSON";
    return { Component: null, error: msg.slice(0, 200) };
  }
}

const VideoPreviewBase = forwardRef<VideoPreviewHandle | null, VideoPreviewProps>(
  function VideoPreviewBase(
    { code, duration = 10, aspectRatio = "16:9", variant = "editor", musicSrc = null },
    ref
  ) {
    const playerRef = useRef<PlayerRef>(null);
    const [Component, setComponent] = useState<React.ComponentType | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cleanPlaying, setCleanPlaying] = useState(false);

    const bgTrack = musicSrc?.trim() || DEFAULT_BG_MUSIC;

    useImperativeHandle(
      ref,
      () => ({
        play: () => playerRef.current?.play(),
        pause: () => playerRef.current?.pause(),
        seekToStart: () => playerRef.current?.seekTo(0),
        seekToFrame: (frame: number) => {
          const maxF = Math.max(0, Math.round(duration * 30) - 1);
          const f = Math.max(0, Math.min(Math.round(frame), maxF));
          playerRef.current?.seekTo(f);
        },
      }),
      [duration]
    );

    useEffect(() => {
      if (!code) {
        setComponent(null);
        setError(null);
        return;
      }
      const { Component: C, error: err } = parseComposition(code, bgTrack);
      setError(err);
      setComponent(() => (C ? C : null));
    }, [code, bgTrack]);

    useEffect(() => {
      const handleError = (event: ErrorEvent) => {
        if (event.message?.includes("EncodingError") || event.message?.includes("decode")) {
          setError(
            "Video encoding error: An image in the animation could not be processed. Try a different prompt."
          );
        }
      };
      window.addEventListener("error", handleError);
      return () => window.removeEventListener("error", handleError);
    }, []);

    if (error) {
      return (
        <div className="flex items-center justify-center h-full bg-black text-red-500 text-xs p-4">
          {error}
        </div>
      );
    }

    if (!Component) {
      return (
        <div className="relative flex flex-col items-center justify-center h-full bg-[#020617] overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />
          <div className="relative z-10 flex flex-col items-center animate-pulse">
            <Monitor className="text-slate-600 w-8 h-8 mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-600">System Standby</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative h-full w-full bg-black group overflow-hidden">
        <div className="relative z-10 w-full h-full flex items-center justify-center p-2">
          <div
            data-remotion-player="true"
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: aspectRatio === "9:16" ? "auto" : aspectRatio === "1:1" ? "min(100%, 100vh)" : "100%",
                height: aspectRatio === "9:16" ? "100%" : aspectRatio === "1:1" ? "min(100%, 100vh)" : "auto",
                aspectRatio: aspectRatio === "9:16" ? "9/16" : aspectRatio === "1:1" ? "1/1" : "16/9",
                maxHeight: "100%",
                maxWidth: "100%",
                overflow: "hidden",
                borderRadius: "1rem",
                position: "relative",
              }}
            >
              <Player
                ref={playerRef}
                component={Component}
                durationInFrames={Math.max(1, duration * 30)}
                fps={30}
                compositionWidth={aspectRatio === "9:16" ? 720 : aspectRatio === "1:1" ? 1080 : 1280}
                compositionHeight={aspectRatio === "9:16" ? 1280 : aspectRatio === "1:1" ? 1080 : 720}
                style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
                acknowledgeRemotionLicense
                controls={variant === "editor"}
                loop
                numberOfSharedAudioTags={5}
                errorFallback={({ error: playerError }) => (
                  <div
                    style={{
                      color: "#f87171",
                      padding: "16px",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      background: "#000",
                      height: "100%",
                    }}
                  >
                    {playerError?.message?.split("\n")[0]?.slice(0, 200) || "Render error"}
                  </div>
                )}
              />
              {variant === "clean" && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 border border-white/10">
                  <button
                    type="button"
                    className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20"
                    aria-label={cleanPlaying ? "Pause" : "Play"}
                    onClick={() => {
                      if (!playerRef.current) return;
                      if (playerRef.current.isPlaying()) {
                        playerRef.current.pause();
                        setCleanPlaying(false);
                      } else {
                        playerRef.current.play();
                        setCleanPlaying(true);
                      }
                    }}
                  >
                    {cleanPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 pl-0.5" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export const VideoPreview = React.memo(VideoPreviewBase);
VideoPreview.displayName = "VideoPreview";
