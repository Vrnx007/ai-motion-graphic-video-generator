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
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;

  // Continuous Ken Burns + pan
  const kenBurns = interpolate(frame, [0, durationInFrames], [1.15, 1.0], { extrapolateRight: "clamp" });
  const panX = interpolate(frame, [0, durationInFrames], [-2, 2]);
  const panY = interpolate(frame, [0, durationInFrames], [-1, 1]);

  // Image slide-up entrance
  const imgSpring = spring({ frame: frame - 3, fps, config: { damping: 20, stiffness: 80 } });
  const imgY = interpolate(imgSpring, [0, 1], [height * 0.08, 0]);

  // Text entrance
  const textSpring = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 120 } });

  // Exit
  const exitStart = durationInFrames * 0.8;
  const exitProg = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Spotlight sweep
  const spotlightX = interpolate(frame, [0, durationInFrames], [-30, 130]);

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: `'${fontFamily}', sans-serif`, overflow: "hidden" }}>

      {/* Full-screen image with continuous motion */}
      {imageUrl ? (
        <AbsoluteFill style={{ transform: `translateY(${imgY}px)` }}>
          <Img src={imageUrl} style={{
            width: "115%", height: "115%", objectFit: "cover",
            transform: `scale(${kenBurns}) translate(${panX}%, ${panY}%)`,
            marginLeft: "-7.5%", marginTop: "-7.5%",
          }} />
          {/* Gradient overlays */}
          <AbsoluteFill style={{
            background: `linear-gradient(to top, ${backgroundColor} 0%, ${backgroundColor}aa 35%, transparent 70%, ${backgroundColor}44 100%)`,
          }} />
          {/* Moving spotlight */}
          <div style={{
            position: "absolute", left: `${spotlightX}%`, top: "0%",
            width: "30%", height: "100%",
            background: `linear-gradient(90deg, transparent, ${textColor}06, transparent)`,
            transform: "skewX(-15deg)",
          }} />
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

      {/* Particles */}
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
          }} />
        );
      })}

      {/* Text at bottom — minimal, short */}
      <div style={{
        position: "absolute", bottom: "10%", left: "8%", right: "30%",
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
