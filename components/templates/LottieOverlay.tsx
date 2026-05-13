"use client";

import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Lottie } from "@remotion/lottie";

/** Minimal Lottie scene — pass animationData from LottieFiles JSON when available. */
export function LottieOverlay({
  headline = "",
  animationData,
}: {
  headline?: string;
  animationData?: Record<string, unknown> | string | null;
}) {
  const { width } = useVideoConfig();

  let parsed: Record<string, unknown> | null = null;
  if (typeof animationData === "string") {
    try {
      parsed = JSON.parse(animationData) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  } else if (animationData && typeof animationData === "object") {
    parsed = animationData;
  }

  if (!parsed) {
    return (
      <AbsoluteFill
        style={{
          background: "linear-gradient(135deg,#020617,#1e1b4b)",
          justifyContent: "center",
          alignItems: "center",
          color: "#94a3b8",
          fontSize: Math.min(18, width / 60),
          textAlign: "center",
          padding: 40,
        }}
      >
        {headline || "Lottie animation"}
        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
          Provide valid Lottie JSON in animationData for this template.
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ background: "#020617" }}>
      {headline ? (
        <div
          style={{
            position: "absolute",
            top: "6%",
            left: 0,
            right: 0,
            textAlign: "center",
            color: "#e2e8f0",
            fontSize: Math.min(28, width / 38),
            fontWeight: 700,
            zIndex: 2,
          }}
        >
          {headline}
        </div>
      ) : null}
      <Lottie
        animationData={parsed as any}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </AbsoluteFill>
  );
}
