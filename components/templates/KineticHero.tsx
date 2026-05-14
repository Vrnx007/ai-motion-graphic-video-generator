import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, random } from "remotion";

export interface KineticHeroProps {
  headline: string;
  subheadline?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  imageUrl?: string;
}

// Animated geometric shape
const GeoShape: React.FC<{
  index: number; frame: number; durationInFrames: number; color: string;
}> = ({ index, frame, durationInFrames, color }) => {
  const seed = index * 7;
  const size = 30 + random(seed) * 120;
  const x = random(seed + 1) * 100;
  const y = random(seed + 2) * 100;
  const rotation = interpolate(frame, [0, durationInFrames], [random(seed + 3) * 360, random(seed + 3) * 360 + 180]);
  const drift = interpolate(frame, [0, durationInFrames], [0, -80 - random(seed + 4) * 80]);
  const fadeIn = interpolate(frame, [0, 15, durationInFrames - 15, durationInFrames], [0, 0.08 + random(seed + 5) * 0.12, 0.08, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shapes = ["0%", "30%", "50%"]; // square, rounded, circle
  const borderRadius = shapes[Math.floor(random(seed + 6) * 3)];
  const scale = interpolate(frame, [0, durationInFrames * 0.5, durationInFrames], [0.6, 1.2, 0.8]);

  return (
    <div style={{
      position: "absolute", left: `${x}%`, top: `${y}%`,
      width: size, height: size,
      borderRadius, border: `1.5px solid ${color}`,
      opacity: fadeIn,
      transform: `translateY(${drift}px) rotate(${rotation}deg) scale(${scale})`,
      background: random(seed + 7) > 0.7 ? `${color}08` : "transparent",
    }} />
  );
};

export const KineticHero: React.FC<KineticHeroProps> = ({
  headline, subheadline, primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, imageUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;

  const words = (headline || "").split(" ");

  // Continuous background motion
  const orbX = interpolate(frame, [0, durationInFrames], [20, 60]);
  const orbY = interpolate(frame, [0, durationInFrames], [30, 50]);
  const orb2X = interpolate(frame, [0, durationInFrames], [70, 30]);

  // Optional mood background: never crop — contain + stable scale (not a hero product shot)
  const imgBgOpacity = interpolate(frame, [0, 20], [0, 0.35], { extrapolateRight: "clamp" });

  // Text exit animation (last 20% of duration)
  const exitStart = durationInFrames * 0.75;
  const exitProgress = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: `'${fontFamily}', Inter, sans-serif`, overflow: "hidden" }}>

      {/* Moving gradient orbs — continuous */}
      <div style={{
        position: "absolute", left: `${orbX}%`, top: `${orbY}%`,
        width: "50%", height: "50%", borderRadius: "50%",
        background: `radial-gradient(circle, ${primaryColor}30, transparent)`,
        filter: "blur(80px)", transform: "translate(-50%, -50%)",
      }} />
      <div style={{
        position: "absolute", left: `${orb2X}%`, top: "60%",
        width: "40%", height: "40%", borderRadius: "50%",
        background: `radial-gradient(circle, ${secondary}25, transparent)`,
        filter: "blur(60px)", transform: "translate(-50%, -50%)",
      }} />

      {/* Background image — continuously panning */}
      {imageUrl && (
        <AbsoluteFill style={{ opacity: imgBgOpacity }}>
          <Img src={imageUrl} style={{
            width: "100%", height: "100%", objectFit: "contain",
            objectPosition: "center center",
            filter: "brightness(0.35) saturate(1.1)",
          }} />
          <AbsoluteFill style={{
            background: `linear-gradient(135deg, ${backgroundColor}dd 0%, transparent 50%, ${backgroundColor}cc 100%)`
          }} />
        </AbsoluteFill>
      )}

      {/* Animated geometric shapes — move throughout entire scene */}
      {Array.from({ length: 15 }).map((_, i) => (
        <GeoShape key={i} index={i} frame={frame} durationInFrames={durationInFrames} color={primaryColor} />
      ))}

      {/* Floating particles — continuous */}
      {Array.from({ length: 40 }).map((_, i) => {
        const seed = i * 11 + 100;
        const px = random(seed) * 100;
        const startY = 110;
        const speed = 0.5 + random(seed + 1) * 1;
        const pSize = 1 + random(seed + 2) * 4;
        const yPos = interpolate(frame, [0, durationInFrames], [startY, startY - speed * 150]);
        const wobble = Math.sin((frame + random(seed + 3) * 100) * 0.05) * 10;
        const pOpacity = interpolate(frame, [0, 10, durationInFrames - 10, durationInFrames], [0, 0.15 + random(seed + 4) * 0.2, 0.15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={i} style={{
            position: "absolute", left: `${px}%`, top: `${yPos}%`,
            width: pSize, height: pSize, borderRadius: "50%",
            backgroundColor: random(seed + 5) > 0.5 ? primaryColor : secondary,
            opacity: pOpacity,
            transform: `translateX(${wobble}px)`,
            boxShadow: pSize > 3 ? `0 0 ${pSize * 2}px ${primaryColor}44` : "none",
          }} />
        );
      })}

      {/* Content — with exit animation */}
      <AbsoluteFill style={{
        justifyContent: "center", alignItems: "flex-start", padding: "8% 10%",
        opacity: interpolate(exitProgress, [0, 1], [1, 0]),
        transform: `translateY(${interpolate(exitProgress, [0, 1], [0, -40])}px)`,
      }}>
        {/* Headline — word by word */}
        <div style={{ marginBottom: 24 }}>
          {words.map((word, i) => {
            const ws = spring({ frame: frame - (i * 4), fps, config: { damping: 16, stiffness: 140, mass: 1.2 } });
            const yVal = interpolate(ws, [0, 1], [100, 0]);
            const opVal = interpolate(ws, [0, 0.3, 1], [0, 0, 1]);
            const isHL = i === words.length - 1;
            return (
              <div key={i} style={{ overflow: "hidden", display: "inline-block", marginRight: "0.3em" }}>
                <span style={{
                  display: "inline-block",
                  fontSize: Math.min(width * 0.075, 110),
                  fontWeight: 900, color: isHL ? primaryColor : textColor,
                  lineHeight: 1.05, textTransform: "uppercase", letterSpacing: "-0.03em",
                  transform: `translateY(${yVal}px)`, opacity: opVal,
                  textShadow: isHL ? `0 0 40px ${primaryColor}55` : "none",
                }}>
                  {word}
                </span>
              </div>
            );
          })}
        </div>

        {/* Short subheadline */}
        {subheadline && (
          <p style={{
            fontSize: Math.min(width * 0.02, 26), fontWeight: 400,
            color: textColor, opacity: interpolate(spring({ frame: frame - (words.length * 4 + 10), fps, config: { damping: 14 } }), [0, 0.3, 1], [0, 0, 0.7]),
            margin: 0, maxWidth: "50%", lineHeight: 1.5,
            transform: `translateY(${interpolate(spring({ frame: frame - (words.length * 4 + 10), fps, config: { damping: 14 } }), [0, 1], [20, 0])}px)`,
          }}>
            {subheadline}
          </p>
        )}
      </AbsoluteFill>

      {/* Scan lines */}
      <AbsoluteFill style={{
        background: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${textColor}02 3px, ${textColor}02 4px)`,
        pointerEvents: "none",
      }} />
    </AbsoluteFill>
  );
};
