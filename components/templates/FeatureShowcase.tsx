import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, random } from "remotion";

export interface FeatureShowcaseProps {
  headline: string;
  subheadline?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  imageUrl?: string;
}

export const FeatureShowcase: React.FC<FeatureShowcaseProps> = ({
  headline, subheadline, primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, imageUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;

  /** Keep product UI fully visible: no Ken Burns zoom-out, no cover crop. */
  const settle = spring({ frame: frame - 2, fps, config: { damping: 22, stiffness: 120 } });
  const imgOpacity = interpolate(settle, [0, 0.35, 1], [0, 0, 1]);

  // Text entrance
  const textSpring = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 120 } });

  // Exit
  const exitStart = durationInFrames * 0.8;
  const exitProg = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: `'${fontFamily}', sans-serif`, overflow: "hidden" }}>

      {/* Screenshot: contained, centered, no crop — optional tiny parallax only */}
      {imageUrl ? (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            paddingTop: "4%",
            paddingBottom: "22%",
            paddingLeft: "4%",
            paddingRight: "4%",
            opacity: imgOpacity,
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 20,
              border: `1px solid ${textColor}12`,
              boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
              background: "#0f172a",
              overflow: "hidden",
            }}
          >
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center center",
                transform: `translate(${Math.sin(frame * 0.02) * 3}px, ${Math.cos(frame * 0.018) * 2}px)`,
              }}
            />
          </div>
          {/* Light bottom scrim for text legibility only */}
          <AbsoluteFill
            style={{
              pointerEvents: "none",
              background: `linear-gradient(to top, ${backgroundColor}f0 0%, ${backgroundColor}99 18%, transparent 42%)`,
            }}
          />
        </AbsoluteFill>
      ) : (
        /* Abstract visual when no image */
        <AbsoluteFill>
          {/* Rotating mesh gradient */}
          <div style={{
            position: "absolute", width: "200%", height: "200%", left: "-50%", top: "-50%",
            background: `conic-gradient(from ${frame * 0.3}deg at 50% 50%, ${primaryColor}12, ${secondary}12, ${backgroundColor}, ${primaryColor}12)`,
          }} />
          {/* Floating circles */}
          {Array.from({ length: 8 }).map((_, i) => {
            const seed = i * 13;
            const cx = 20 + random(seed) * 60;
            const cy = 20 + random(seed + 1) * 60;
            const sz = 100 + random(seed + 2) * 200;
            const moveX = interpolate(frame, [0, durationInFrames], [cx, cx + (random(seed + 3) - 0.5) * 30]);
            const moveY = interpolate(frame, [0, durationInFrames], [cy, cy + (random(seed + 4) - 0.5) * 20]);
            const breathe = interpolate(frame, [0, durationInFrames * 0.5, durationInFrames], [1, 1.2, 1]);
            return (
              <div key={i} style={{
                position: "absolute", left: `${moveX}%`, top: `${moveY}%`,
                width: sz, height: sz, borderRadius: "50%",
                border: `1px solid ${primaryColor}15`,
                background: random(seed + 5) > 0.6 ? `${primaryColor}06` : "transparent",
                transform: `translate(-50%,-50%) scale(${breathe})`,
              }} />
            );
          })}
        </AbsoluteFill>
      )}

      {/* Particles — stay behind text */}
      {Array.from({ length: 25 }).map((_, i) => {
        const seed = i * 9 + 50;
        const drift = interpolate(frame, [0, durationInFrames], [0, -60 - random(seed) * 60]);
        const wobble = Math.sin((frame + i * 20) * 0.04) * 8;
        return (
          <div key={i} style={{
            position: "absolute", left: `${random(seed + 1) * 100}%`, top: `${random(seed + 2) * 100}%`,
            width: 1.5 + random(seed + 3) * 3, height: 1.5 + random(seed + 3) * 3,
            borderRadius: "50%", backgroundColor: primaryColor,
            opacity: interpolate(frame, [0, 15, durationInFrames - 15, durationInFrames], [0, 0.2, 0.15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `translateY(${drift}px) translateX(${wobble}px)`,
            zIndex: 2,
          }} />
        );
      })}

      {/* Text at bottom — minimal, short */}
      <div style={{
        position: "absolute", bottom: "10%", left: "8%", right: "30%",
        zIndex: 30,
        opacity: interpolate(textSpring, [0, 0.3, 1], [0, 0, 1]) * (1 - exitProg),
        transform: `translateY(${interpolate(textSpring, [0, 1], [30, 0]) + exitProg * -30}px)`,
      }}>
        {/* Accent line */}
        <div style={{
          width: interpolate(textSpring, [0, 1], [0, 60]),
          height: 3, borderRadius: 2, marginBottom: 16,
          background: `linear-gradient(90deg, ${primaryColor}, ${secondary})`,
          boxShadow: `0 0 15px ${primaryColor}44`,
        }} />
        <h2 style={{
          fontSize: Math.min(width * 0.04, 52), fontWeight: 800,
          color: textColor, margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em",
        }}>
          {headline}
        </h2>
      </div>
    </AbsoluteFill>
  );
};
