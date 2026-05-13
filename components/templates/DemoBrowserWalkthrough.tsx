"use client";

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  spring,
} from "remotion";

/** SaaS-style walkthrough: browser chrome + guided cursor (pattern inspired by remotion-saas-showcase). */
export function DemoBrowserWalkthrough({
  headline = "See it in action",
  subheadline = "",
  imageUrl = "",
}: {
  headline?: string;
  subheadline?: string;
  imageUrl?: string;
}) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const pad = spring({ frame, fps, from: 0, to: 1, durationInFrames: 18 });

  const cx = interpolate(frame, [0, 40, 90, 140], [width * 0.22, width * 0.62, width * 0.55, width * 0.35]);
  const cy = interpolate(frame, [0, 40, 90, 140], [280, 220, 380, 320]);
  const clickPulse = spring({
    frame: frame - 55,
    fps,
    config: { damping: 12 },
    from: 0,
    to: 1,
    durationInFrames: 8,
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(165deg,#0f172a 0%,#020617 55%,#0f172a 100%)",
        fontFamily: "system-ui,sans-serif",
        opacity: pad,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "6%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          color: "#f8fafc",
          maxWidth: "88%",
        }}
      >
        <div style={{ fontSize: Math.min(46, width / 24), fontWeight: 800, letterSpacing: "-0.03em" }}>
          {headline}
        </div>
        {subheadline ? (
          <div style={{ marginTop: 10, color: "#94a3b8", fontSize: Math.min(17, width / 55) }}>{subheadline}</div>
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "52%",
          transform: "translate(-50%,-50%)",
          width: "78%",
          maxWidth: 920,
          aspectRatio: "16/10",
          borderRadius: 14,
          border: "1px solid rgba(148,163,184,0.25)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
          overflow: "hidden",
          background: "linear-gradient(180deg,#1e293b,#0f172a)",
        }}
      >
        <div
          style={{
            height: 36,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 14px",
            borderBottom: "1px solid rgba(148,163,184,0.2)",
            background: "rgba(15,23,42,0.9)",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#f87171" }} />
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#fbbf24" }} />
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#4ade80" }} />
          <span style={{ marginLeft: 12, fontSize: 11, color: "#64748b" }}>app.yourproduct.com</span>
        </div>
        <div style={{ position: "relative", height: "calc(100% - 36px)", background: "#020617" }}>
          {imageUrl ? (
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" }),
                transform: `scale(${interpolate(frame, [8, 40], [0.96, 1], { extrapolateRight: "clamp" })})`,
              }}
            />
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#475569",
                fontSize: 14,
              }}
            >
              Drop a product screenshot (imageUrl)
            </div>
          )}
          <div
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              width: 28,
              height: 28,
              borderRadius: "50% 50% 50% 0",
              background: "rgba(255,255,255,0.95)",
              border: "2px solid rgba(15,23,42,0.85)",
              transform: `rotate(-35deg) scale(${0.9 + clickPulse * 0.15})`,
              boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}
