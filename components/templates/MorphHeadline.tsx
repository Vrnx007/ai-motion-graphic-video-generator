import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, random } from "remotion";

export interface MorphHeadlineProps {
  headline: string;
  subheadline?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

/**
 * Letter-by-letter morphing kinetic headline with rotating glyph ghosts,
 * radial sweep, blur trails. Designed for the "wow" beat of a product film.
 */
export const MorphHeadline: React.FC<MorphHeadlineProps> = ({
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

  const chars = (headline || "").split("");

  // Sweeping radial gradient angle
  const sweep = interpolate(frame, [0, durationInFrames], [0, 360]);

  const exitStart = durationInFrames * 0.85;
  const exitProgress = interpolate(frame, [exitStart, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        fontFamily: `'${fontFamily}', Inter, sans-serif`,
        overflow: "hidden",
      }}
    >
      {/* Rotating conic mesh */}
      <div
        style={{
          position: "absolute",
          inset: "-25%",
          background: `conic-gradient(from ${sweep}deg at 50% 50%, ${primaryColor}1a, ${secondary}1a, ${backgroundColor}, ${primaryColor}1a)`,
          filter: "blur(40px)",
        }}
      />

      {/* Radial pulse rings */}
      {Array.from({ length: 4 }).map((_, i) => {
        const cycle = 1.5 + i * 0.4;
        const phase = (frame / fps / cycle) % 1;
        const size = 200 + phase * 1400;
        const op = (1 - phase) * 0.18;
        return (
          <div
            key={`ring-${i}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "55%",
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: "50%",
              border: `1.5px solid ${primaryColor}`,
              opacity: op,
              filter: "blur(0.5px)",
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* Particle dust */}
      {Array.from({ length: 60 }).map((_, i) => {
        const seed = i * 13 + 7;
        const x = random(seed) * 100;
        const y = ((random(seed + 1) * 100 + frame * 0.4) % 110 + 110) % 110;
        const sz = 1 + random(seed + 2) * 2.5;
        const op = 0.15 + random(seed + 3) * 0.35;
        return (
          <div
            key={`p-${i}`}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: sz,
              height: sz,
              borderRadius: "50%",
              backgroundColor: random(seed + 4) > 0.5 ? primaryColor : secondary,
              opacity: op * (1 - exitProgress),
            }}
          />
        );
      })}

      {/* Headline: each char morphs in with stagger + scale + blur */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 6%",
          transform: `translateY(${exitProgress * -60}px)`,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: Math.min(width * 0.095, 150),
            fontWeight: 900,
            color: textColor,
            textTransform: "uppercase",
            lineHeight: 1.0,
            letterSpacing: "-0.045em",
            textAlign: "center",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {chars.map((ch, i) => {
            const s = spring({
              frame: frame - i * 2.5 - 6,
              fps,
              config: { damping: 14, stiffness: 130, mass: 1.1 },
            });
            const op = interpolate(s, [0, 0.25, 1], [0, 0, 1]) * (1 - exitProgress);
            const yShift = interpolate(s, [0, 1], [80, 0]);
            const blur = interpolate(s, [0, 0.5, 1], [10, 3, 0]);
            const rot = interpolate(s, [0, 1], [-8 + (i % 2) * 16, 0]);
            const isAccent = i === Math.floor(chars.length * 0.5);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: op,
                  transform: `translateY(${yShift}px) rotate(${rot}deg)`,
                  filter: `blur(${blur}px)`,
                  color: isAccent ? primaryColor : textColor,
                  textShadow: isAccent ? `0 0 40px ${primaryColor}88` : "none",
                  whiteSpace: "pre",
                }}
              >
                {ch === " " ? "\u00A0" : ch}
              </span>
            );
          })}
        </h1>

        {subheadline && (
          <p
            style={{
              fontSize: Math.min(width * 0.02, 24),
              color: textColor,
              opacity:
                interpolate(
                  spring({ frame: frame - chars.length * 2.5 - 18, fps, config: { damping: 14 } }),
                  [0, 0.3, 1],
                  [0, 0, 0.75]
                ) *
                (1 - exitProgress),
              margin: "32px 0 0 0",
              maxWidth: "60%",
              textAlign: "center",
              fontWeight: 400,
              lineHeight: 1.45,
            }}
          >
            {subheadline}
          </p>
        )}
      </AbsoluteFill>

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.5) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
