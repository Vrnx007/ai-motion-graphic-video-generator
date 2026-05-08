import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, random } from "remotion";

export interface LogoRevealProps {
  headline: string;
  subheadline?: string;
  ctaText?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  imageUrl?: string; // logo URL
}

export const LogoReveal: React.FC<LogoRevealProps> = ({
  headline, subheadline, ctaText, primaryColor, secondaryColor,
  backgroundColor, textColor, fontFamily, imageUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;

  // Ring expansion
  const ringSpring = spring({ frame: frame - 5, fps, config: { damping: 20, stiffness: 60, mass: 2 } });
  const ringScale = interpolate(ringSpring, [0, 1], [0, 1]);
  const ringOpacity = interpolate(ringSpring, [0, 0.2, 0.8, 1], [0, 0.6, 0.3, 0]);

  // Logo pop
  const logoSpring = spring({ frame: frame - 15, fps, config: { damping: 12, stiffness: 150 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0, 1]);
  const logoRotate = interpolate(logoSpring, [0, 1], [-10, 0]);

  // Text reveals
  const headSpring = spring({ frame: frame - 30, fps, config: { damping: 14 } });
  const subSpring = spring({ frame: frame - 42, fps, config: { damping: 14 } });
  const ctaSpring = spring({ frame: frame - 55, fps, config: { damping: 12, stiffness: 100 } });

  // Rotating gradient background
  const bgRotation = interpolate(frame, [0, durationInFrames], [0, 60]);

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: `'${fontFamily}', sans-serif`, overflow: "hidden" }}>

      {/* Rotating conic gradient */}
      <div style={{
        position: "absolute", width: "200%", height: "200%",
        left: "-50%", top: "-50%",
        background: `conic-gradient(from ${bgRotation}deg at 50% 50%, ${primaryColor}08, ${secondary}08, ${primaryColor}08)`,
      }} />

      {/* Radial glow */}
      <div style={{
        position: "absolute", left: "50%", top: "45%",
        width: "60%", height: "60%",
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        background: `radial-gradient(circle, ${primaryColor}25, transparent)`,
        filter: "blur(60px)",
        opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" }),
      }} />

      {/* Expanding ring */}
      <div style={{
        position: "absolute", left: "50%", top: "40%",
        transform: `translate(-50%, -50%) scale(${ringScale})`,
        width: 400, height: 400,
        borderRadius: "50%",
        border: `2px solid ${primaryColor}`,
        opacity: ringOpacity,
        boxShadow: `0 0 40px ${primaryColor}44, inset 0 0 40px ${primaryColor}22`,
      }} />

      {/* Second ring */}
      <div style={{
        position: "absolute", left: "50%", top: "40%",
        transform: `translate(-50%, -50%) scale(${interpolate(
          spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 50, mass: 2 } }),
          [0, 1], [0, 1]
        )})`,
        width: 600, height: 600,
        borderRadius: "50%",
        border: `1px solid ${primaryColor}33`,
        opacity: interpolate(
          spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 50, mass: 2 } }),
          [0, 0.2, 0.8, 1], [0, 0.4, 0.15, 0]
        ),
      }} />

      {/* Logo / Image */}
      <div style={{
        position: "absolute", left: "50%", top: "40%",
        transform: `translate(-50%, -50%) scale(${logoScale}) rotate(${logoRotate}deg)`,
      }}>
        {imageUrl ? (
          <div style={{
            width: 120, height: 120, borderRadius: 28,
            overflow: "hidden", backgroundColor: `${textColor}08`,
            border: `1px solid ${textColor}15`,
            boxShadow: `0 20px 50px rgba(0,0,0,0.4), 0 0 30px ${primaryColor}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}>
            <Img src={imageUrl} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
        ) : (
          <div style={{
            width: 100, height: 100, borderRadius: 24,
            background: `linear-gradient(135deg, ${primaryColor}, ${secondary})`,
            boxShadow: `0 20px 50px rgba(0,0,0,0.4), 0 0 30px ${primaryColor}44`,
          }} />
        )}
      </div>

      {/* Text content */}
      <div style={{
        position: "absolute", left: "50%", bottom: "18%",
        transform: "translateX(-50%)",
        textAlign: "center", width: "80%",
      }}>
        {/* Headline */}
        <h1 style={{
          fontSize: Math.min(width * 0.045, 64), fontWeight: 800,
          color: textColor, margin: 0, lineHeight: 1.2,
          letterSpacing: "-0.02em",
          opacity: interpolate(headSpring, [0, 0.3, 1], [0, 0, 1]),
          transform: `translateY(${interpolate(headSpring, [0, 1], [30, 0])}px)`,
        }}>
          {headline}
        </h1>

        {/* Subheadline */}
        {subheadline && (
          <p style={{
            fontSize: Math.min(width * 0.018, 22), fontWeight: 400,
            color: textColor, opacity: interpolate(subSpring, [0, 0.3, 1], [0, 0, 0.6]),
            transform: `translateY(${interpolate(subSpring, [0, 1], [20, 0])}px)`,
            margin: "16px 0 0",
          }}>
            {subheadline}
          </p>
        )}

        {/* CTA Button */}
        {ctaText && (
          <div style={{
            marginTop: 30,
            opacity: interpolate(ctaSpring, [0, 0.3, 1], [0, 0, 1]),
            transform: `translateY(${interpolate(ctaSpring, [0, 1], [20, 0])}px) scale(${interpolate(ctaSpring, [0, 1], [0.9, 1])})`,
          }}>
            <div style={{
              display: "inline-block",
              padding: "14px 36px",
              borderRadius: 14,
              background: `linear-gradient(135deg, ${primaryColor}, ${secondary})`,
              color: "#FFFFFF",
              fontSize: Math.min(width * 0.016, 18),
              fontWeight: 700,
              boxShadow: `0 8px 24px ${primaryColor}44`,
              letterSpacing: "0.02em",
            }}>
              {ctaText}
            </div>
          </div>
        )}
      </div>

      {/* Particles */}
      {Array.from({ length: 25 }).map((_, i) => {
        const seed = i * 9;
        const angle = random(seed) * Math.PI * 2;
        const dist = 50 + random(seed + 1) * 200;
        const delay = 15 + random(seed + 2) * 30;
        const progress = interpolate(frame - delay, [0, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const px = 50 + Math.cos(angle) * dist * progress * 0.15;
        const py = 40 + Math.sin(angle) * dist * progress * 0.15;
        const size = 1 + random(seed + 3) * 3;
        const pOpacity = interpolate(progress, [0, 0.2, 0.8, 1], [0, 0.3, 0.2, 0]);

        return (
          <div key={i} style={{
            position: "absolute", left: `${px}%`, top: `${py}%`,
            width: size, height: size, borderRadius: "50%",
            backgroundColor: primaryColor, opacity: pOpacity,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};
