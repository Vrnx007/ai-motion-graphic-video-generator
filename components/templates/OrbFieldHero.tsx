import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, random } from "remotion";

export interface OrbFieldHeroProps {
  headline: string;
  subheadline?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

export const OrbFieldHero: React.FC<OrbFieldHeroProps> = ({
  headline,
  subheadline,
  primaryColor,
  secondaryColor,
  backgroundColor,
  textColor,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;

  const titleSpring = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const titleY = interpolate(titleSpring, [0, 1], [28, 0]);

  const hueShift = interpolate(frame, [0, durationInFrames], [0, 40], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        fontFamily: `'${fontFamily}', sans-serif`,
        overflow: "hidden",
        background: `radial-gradient(120% 80% at 50% 110%, ${primaryColor}55 0%, ${backgroundColor} 45%, #020617 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `conic-gradient(from ${frame * 0.45 + hueShift}deg at 50% 42%, ${primaryColor}22, ${secondary}18, transparent 55%, ${primaryColor}14)`,
          opacity: 0.95,
        }}
      />
      {Array.from({ length: 18 }).map((_, i) => {
        const seed = i * 11;
        const cx = 8 + random(seed) * 84;
        const cy = 8 + random(seed + 1) * 84;
        const r = 40 + random(seed + 2) * 160;
        const bob = Math.sin(frame * 0.04 + seed * 0.2) * 14;
        const base = i % 2 === 0 ? primaryColor : secondary;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              width: r,
              height: r,
              marginLeft: -r / 2,
              marginTop: -r / 2,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${base}55 0%, transparent 68%)`,
              filter: "blur(28px)",
              opacity: 0.55 + Math.sin(frame * 0.07 + i) * 0.2,
              transform: `translateY(${bob}px) scale(${0.85 + (i % 3) * 0.08})`,
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 8%",
          zIndex: 3,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            fontSize: Math.min(56, width / 14),
            fontWeight: 900,
            letterSpacing: "-0.04em",
            color: textColor,
            textShadow: `0 12px 60px ${primaryColor}66`,
            lineHeight: 1.05,
            maxWidth: "92%",
          }}
        >
          {headline}
        </div>
        {subheadline ? (
          <div
            style={{
              marginTop: 14,
              fontSize: Math.min(20, width / 42),
              fontWeight: 500,
              color: `${textColor}aa`,
              maxWidth: "80%",
            }}
          >
            {subheadline}
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "32%",
          background: `linear-gradient(to top, ${backgroundColor}ee, transparent)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
