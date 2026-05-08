import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, random } from "remotion";

export interface KineticHeroProps {
  headline: string;
  subheadline: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  imageUrl?: string;
}

// Floating particle component
const Particle: React.FC<{
  index: number; frame: number; fps: number; color: string; durationInFrames: number;
}> = ({ index, frame, fps, color, durationInFrames }) => {
  const seed = index * 7;
  const x = random(seed) * 100;
  const startY = 100 + random(seed + 1) * 20;
  const size = 2 + random(seed + 2) * 4;
  const speed = 0.3 + random(seed + 3) * 0.7;
  const delay = random(seed + 4) * 40;
  const opacity = 0.1 + random(seed + 5) * 0.3;

  const progress = interpolate(frame - delay, [0, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(progress, [0, 1], [startY, -20]);
  const fadeIn = interpolate(progress, [0, 0.1, 0.8, 1], [0, opacity, opacity, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      borderRadius: "50%",
      backgroundColor: color,
      opacity: fadeIn,
      filter: `blur(${size > 4 ? 1 : 0}px)`,
    }} />
  );
};

// Animated gradient orb
const GradientOrb: React.FC<{
  x: string; y: string; size: string; color1: string; color2: string;
  frame: number; durationInFrames: number; delay?: number;
}> = ({ x, y, size, color1, color2, frame, durationInFrames, delay = 0 }) => {
  const breathe = interpolate(
    frame - delay,
    [0, durationInFrames * 0.5, durationInFrames],
    [1, 1.3, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = interpolate(frame - delay, [0, 20, durationInFrames - 20, durationInFrames], [0, 0.4, 0.4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{
      position: "absolute", left: x, top: y,
      width: size, height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color1}, ${color2}, transparent)`,
      filter: "blur(80px)",
      transform: `scale(${breathe})`,
      opacity,
    }} />
  );
};

export const KineticHero: React.FC<KineticHeroProps> = ({
  headline, subheadline, primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, imageUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;

  // Background subtle zoom
  const bgScale = interpolate(frame, [0, durationInFrames], [1.15, 1.0], { extrapolateRight: "clamp" });

  // Split headline by words
  const words = (headline || "").split(" ");

  // Line under headline
  const lineWidth = interpolate(
    spring({ frame: frame - (words.length * 3 + 5), fps, config: { damping: 15, stiffness: 80 } }),
    [0, 1], [0, 100]
  );

  // CTA button reveal
  const ctaProgress = spring({ frame: frame - (words.length * 3 + 20), fps, config: { damping: 12 } });
  const ctaY = interpolate(ctaProgress, [0, 1], [40, 0]);
  const ctaOpacity = interpolate(ctaProgress, [0, 0.5, 1], [0, 0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: `'${fontFamily}', Inter, sans-serif`, overflow: "hidden" }}>

      {/* Gradient Orbs */}
      <GradientOrb x="-10%" y="-10%" size="60%" color1={`${primaryColor}55`} color2="transparent" frame={frame} durationInFrames={durationInFrames} />
      <GradientOrb x="60%" y="50%" size="50%" color1={`${secondary}44`} color2="transparent" frame={frame} durationInFrames={durationInFrames} delay={10} />
      <GradientOrb x="30%" y="-20%" size="40%" color1={`${primaryColor}22`} color2="transparent" frame={frame} durationInFrames={durationInFrames} delay={20} />

      {/* Background Image with Ken Burns */}
      {imageUrl && (
        <AbsoluteFill>
          <Img
            src={imageUrl}
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              transform: `scale(${bgScale})`,
              filter: "brightness(0.3) saturate(1.2)",
            }}
          />
          {/* Gradient overlay */}
          <AbsoluteFill style={{
            background: `linear-gradient(135deg, ${backgroundColor}ee 0%, ${backgroundColor}88 50%, ${backgroundColor}cc 100%)`
          }} />
        </AbsoluteFill>
      )}

      {/* Grid pattern overlay */}
      <AbsoluteFill style={{
        backgroundImage: `linear-gradient(${textColor}08 1px, transparent 1px), linear-gradient(90deg, ${textColor}08 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
        opacity: interpolate(frame, [0, 30], [0, 0.5], { extrapolateRight: "clamp" }),
      }} />

      {/* Floating particles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <Particle key={i} index={i} frame={frame} fps={fps} color={primaryColor} durationInFrames={durationInFrames} />
      ))}

      {/* Content */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-start", padding: "8% 10%" }}>

        {/* Kinetic Headline — word by word reveal with clip mask */}
        <div style={{ marginBottom: 30 }}>
          {words.map((word, i) => {
            const wordSpring = spring({
              frame: frame - (i * 4),
              fps,
              config: { damping: 16, stiffness: 140, mass: 1.2 }
            });
            const yVal = interpolate(wordSpring, [0, 1], [120, 0]);
            const opacityVal = interpolate(wordSpring, [0, 0.3, 1], [0, 0, 1]);
            const scaleVal = interpolate(wordSpring, [0, 1], [0.8, 1]);
            const isHighlight = i === words.length - 1 || i === 0;

            return (
              <div key={i} style={{ overflow: "hidden", display: "inline-block", marginRight: "0.3em" }}>
                <span style={{
                  display: "inline-block",
                  fontSize: Math.min(width * 0.08, 120),
                  fontWeight: 900,
                  color: isHighlight ? primaryColor : textColor,
                  lineHeight: 1.1,
                  textTransform: "uppercase",
                  letterSpacing: "-0.03em",
                  transform: `translateY(${yVal}px) scale(${scaleVal})`,
                  opacity: opacityVal,
                  textShadow: isHighlight ? `0 0 40px ${primaryColor}66` : "none",
                }}>
                  {word}
                </span>
              </div>
            );
          })}
        </div>

        {/* Animated accent line */}
        <div style={{
          width: `${lineWidth}%`, maxWidth: 300, height: 4,
          background: `linear-gradient(90deg, ${primaryColor}, ${secondary})`,
          borderRadius: 2, marginBottom: 30,
          boxShadow: `0 0 20px ${primaryColor}66`,
        }} />

        {/* Subheadline with glassmorphism card */}
        {subheadline && (
          <div style={{
            overflow: "hidden",
            opacity: interpolate(
              spring({ frame: frame - (words.length * 4 + 8), fps, config: { damping: 14 } }),
              [0, 1], [0, 1]
            ),
            transform: `translateY(${interpolate(
              spring({ frame: frame - (words.length * 4 + 8), fps, config: { damping: 14 } }),
              [0, 1], [30, 0]
            )}px)`,
          }}>
            <div style={{
              background: `${textColor}08`,
              backdropFilter: "blur(20px)",
              border: `1px solid ${textColor}15`,
              borderRadius: 16, padding: "20px 28px",
              maxWidth: "55%",
            }}>
              <p style={{
                fontSize: Math.min(width * 0.022, 28),
                fontWeight: 400, color: textColor, margin: 0,
                lineHeight: 1.6, opacity: 0.85,
              }}>
                {subheadline}
              </p>
            </div>
          </div>
        )}
      </AbsoluteFill>

      {/* Scan line effect */}
      <AbsoluteFill style={{
        background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${textColor}03 2px, ${textColor}03 4px)`,
        pointerEvents: "none",
      }} />
    </AbsoluteFill>
  );
};
