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

  // Image reveal — slides up with scale
  const imgSpring = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 90 } });
  const imgY = interpolate(imgSpring, [0, 1], [height * 0.15, 0]);
  const imgScale = interpolate(imgSpring, [0, 1], [1.1, 1]);
  const imgOpacity = interpolate(imgSpring, [0, 0.3, 1], [0, 0, 1]);

  // Ken Burns slow zoom
  const kenBurns = interpolate(frame, [0, durationInFrames], [1.08, 1.0], { extrapolateRight: "clamp" });

  // Text overlay
  const textSpring = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 120 } });
  const textY = interpolate(textSpring, [0, 1], [50, 0]);
  const textOpacity = interpolate(textSpring, [0, 0.3, 1], [0, 0, 1]);

  // Highlight pulse
  const pulse = interpolate(frame % 60, [0, 30, 60], [1, 1.05, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: `'${fontFamily}', sans-serif`, overflow: "hidden" }}>

      {/* Full-screen image */}
      {imageUrl && (
        <AbsoluteFill style={{ opacity: imgOpacity, transform: `translateY(${imgY}px)` }}>
          <Img src={imageUrl} style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: `scale(${imgScale * kenBurns})`,
          }} />
          {/* Dark gradient overlay */}
          <AbsoluteFill style={{
            background: `linear-gradient(to top, ${backgroundColor} 0%, ${backgroundColor}cc 30%, ${backgroundColor}44 60%, ${backgroundColor}88 100%)`,
          }} />
        </AbsoluteFill>
      )}

      {/* If no image, show abstract gradient */}
      {!imageUrl && (
        <AbsoluteFill>
          <div style={{
            position: "absolute", width: "120%", height: "120%", left: "-10%", top: "-10%",
            background: `conic-gradient(from ${frame * 0.5}deg at 50% 50%, ${primaryColor}22, ${secondary}22, ${primaryColor}22)`,
            filter: "blur(80px)",
          }} />
        </AbsoluteFill>
      )}

      {/* Content at bottom */}
      <AbsoluteFill style={{
        justifyContent: "flex-end", padding: "8%",
        transform: `translateY(${textY}px)`, opacity: textOpacity,
      }}>
        {/* Glassmorphism card */}
        <div style={{
          background: `${textColor}06`,
          backdropFilter: "blur(30px)",
          border: `1px solid ${textColor}10`,
          borderRadius: Math.min(width * 0.025, 32),
          padding: "4% 5%",
          maxWidth: "70%",
          boxShadow: `0 20px 60px rgba(0,0,0,0.4)`,
        }}>
          {/* Accent dot */}
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: primaryColor, marginBottom: 16,
            boxShadow: `0 0 15px ${primaryColor}88`,
            transform: `scale(${pulse})`,
          }} />

          <h2 style={{
            fontSize: Math.min(width * 0.045, 64), fontWeight: 800,
            color: textColor, margin: 0, lineHeight: 1.15,
            letterSpacing: "-0.02em",
          }}>
            {headline}
          </h2>

          {subheadline && (
            <p style={{
              fontSize: Math.min(width * 0.018, 22), fontWeight: 400,
              color: textColor, opacity: 0.7, margin: "16px 0 0",
              lineHeight: 1.5,
            }}>
              {subheadline}
            </p>
          )}
        </div>
      </AbsoluteFill>

      {/* Floating particles */}
      {Array.from({ length: 15 }).map((_, i) => {
        const seed = i * 13;
        const px = random(seed) * 100;
        const py = random(seed + 1) * 100;
        const pSize = 1 + random(seed + 2) * 3;
        const pDelay = random(seed + 3) * 30;
        const pOpacity = interpolate(frame - pDelay, [0, 20, durationInFrames - 20, durationInFrames], [0, 0.2 + random(seed + 4) * 0.2, 0.2, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const drift = interpolate(frame, [0, durationInFrames], [0, -30 - random(seed + 5) * 40]);
        return (
          <div key={i} style={{
            position: "absolute", left: `${px}%`, top: `${py}%`,
            width: pSize, height: pSize, borderRadius: "50%",
            backgroundColor: primaryColor, opacity: pOpacity,
            transform: `translateY(${drift}px)`,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};
