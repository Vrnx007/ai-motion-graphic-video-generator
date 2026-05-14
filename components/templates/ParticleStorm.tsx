import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, random, spring } from "remotion";

export interface ParticleStormProps {
  headline: string;
  subheadline?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

const PARTICLE_COUNT = 220;
const TRAIL_COUNT = 14;

/**
 * Cinematic particle storm — 220-particle field with depth, motion blur trails,
 * volumetric light cone, chromatic aberration on title. Designed to feel like a
 * Vercel / Linear launch sting.
 */
export const ParticleStorm: React.FC<ParticleStormProps> = ({
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

  const titleSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 18, stiffness: 100, mass: 1.4 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 0.3, 1], [0, 0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [60, 0]);
  const titleBlur = interpolate(titleSpring, [0, 0.5, 1], [12, 4, 0]);

  const exitStart = durationInFrames * 0.85;
  const exitProgress = interpolate(frame, [exitStart, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Cinematic camera shake (very subtle)
  const shakeX = Math.sin(frame * 0.5) * 1.2;
  const shakeY = Math.cos(frame * 0.4) * 0.9;

  // Volumetric light cone sweeping across
  const beamAngle = interpolate(frame, [0, durationInFrames], [-25, 25]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        fontFamily: `'${fontFamily}', Inter, sans-serif`,
        overflow: "hidden",
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      {/* Base radial glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 70%, ${primaryColor}25, transparent 55%), radial-gradient(ellipse at 30% 30%, ${secondary}20, transparent 60%)`,
        }}
      />

      {/* Volumetric light cone */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "-20%",
          width: "60%",
          height: "120%",
          transform: `translate(-50%, 0) rotate(${beamAngle}deg)`,
          transformOrigin: "50% 0",
          background: `linear-gradient(180deg, ${primaryColor}33 0%, ${primaryColor}15 35%, transparent 75%)`,
          filter: "blur(20px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* Particle field — depth-sorted, 3 layers */}
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const seed = i * 7 + 11;
        const depth = random(seed) ** 2; // bias to background (more small)
        const startX = random(seed + 1) * 100;
        const speed = 1 + random(seed + 2) * 3 + (1 - depth) * 2;
        const yPos = ((random(seed + 3) * 120 - frame * speed * 0.3) % 120 + 120) % 120;
        const size = 0.6 + (1 - depth) * 5;
        const baseOpacity = 0.15 + (1 - depth) * 0.7;
        const wobble = Math.sin((frame + i) * 0.03) * (8 - depth * 6);
        const color = random(seed + 4) > 0.55 ? primaryColor : secondary;
        const isHot = (1 - depth) > 0.75;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${startX}%`,
              top: `${yPos}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: baseOpacity * (1 - exitProgress * 0.6),
              transform: `translateX(${wobble}px) translateZ(0)`,
              boxShadow: isHot ? `0 0 ${size * 4}px ${color}` : "none",
              willChange: "transform",
            }}
          />
        );
      })}

      {/* Motion blur trail streaks */}
      {Array.from({ length: TRAIL_COUNT }).map((_, i) => {
        const seed = i * 23 + 99;
        const yLine = random(seed) * 100;
        const xStart = random(seed + 1) * 100;
        const len = 80 + random(seed + 2) * 220;
        const angle = -8 + random(seed + 3) * 16;
        const drift = interpolate(frame, [0, durationInFrames], [0, -120 + random(seed + 4) * 60]);
        const op = interpolate(
          frame,
          [0, durationInFrames * 0.3, durationInFrames * 0.85, durationInFrames],
          [0, 0.45, 0.45, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <div
            key={`t-${i}`}
            style={{
              position: "absolute",
              left: `${xStart}%`,
              top: `${yLine}%`,
              width: len,
              height: 1.5,
              transform: `translate(${drift}px, 0) rotate(${angle}deg)`,
              background: `linear-gradient(90deg, transparent, ${primaryColor}cc, transparent)`,
              opacity: op,
              filter: "blur(0.5px)",
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* Title with chromatic aberration */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 8%",
          opacity: titleOpacity * (1 - exitProgress),
          transform: `translateY(${titleY + exitProgress * -50}px)`,
          filter: `blur(${titleBlur}px)`,
        }}
      >
        <div style={{ position: "relative", display: "inline-block" }}>
          {/* Red channel offset */}
          <h1
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: -3,
              margin: 0,
              fontSize: Math.min(width * 0.085, 130),
              fontWeight: 900,
              color: "#ff0040",
              mixBlendMode: "screen",
              opacity: 0.55,
              textTransform: "uppercase",
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              textAlign: "center",
            }}
          >
            {headline}
          </h1>
          {/* Blue channel offset */}
          <h1
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 3,
              margin: 0,
              fontSize: Math.min(width * 0.085, 130),
              fontWeight: 900,
              color: "#00d4ff",
              mixBlendMode: "screen",
              opacity: 0.55,
              textTransform: "uppercase",
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              textAlign: "center",
            }}
          >
            {headline}
          </h1>
          <h1
            style={{
              position: "relative",
              margin: 0,
              fontSize: Math.min(width * 0.085, 130),
              fontWeight: 900,
              color: textColor,
              textTransform: "uppercase",
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              textAlign: "center",
              textShadow: `0 0 60px ${primaryColor}66, 0 0 20px ${primaryColor}88`,
            }}
          >
            {headline}
          </h1>
        </div>
        {subheadline && (
          <p
            style={{
              fontSize: Math.min(width * 0.018, 22),
              color: textColor,
              opacity: 0.78,
              margin: "26px 0 0 0",
              maxWidth: "62%",
              textAlign: "center",
              fontWeight: 400,
              lineHeight: 1.45,
              letterSpacing: "0.01em",
            }}
          >
            {subheadline}
          </p>
        )}
      </AbsoluteFill>

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Grain */}
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${textColor}03 2px, ${textColor}03 3px)`,
          mixBlendMode: "overlay",
          opacity: 0.25,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
