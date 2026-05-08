import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, random } from "remotion";

export interface SplitScreenProps {
  headline: string;
  subheadline?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  imageUrl?: string;
}

export const SplitScreen: React.FC<SplitScreenProps> = ({
  headline, subheadline, primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, imageUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;

  // Panels slide in
  const leftSpring = spring({ frame, fps, config: { damping: 20, stiffness: 70 } });
  const leftX = interpolate(leftSpring, [0, 1], [-width * 0.5, 0]);
  const rightSpring = spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 80 } });
  const rightX = interpolate(rightSpring, [0, 1], [width * 0.5, 0]);

  // Continuous image motion
  const imgZoom = interpolate(frame, [0, durationInFrames], [1.15, 1.0], { extrapolateRight: "clamp" });
  const imgRotate = interpolate(frame, [0, durationInFrames], [-1, 1]);

  // Exit
  const exitStart = durationInFrames * 0.8;
  const exitProg = interpolate(frame, [exitStart, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Divider
  const divH = interpolate(spring({ frame: frame - 4, fps, config: { damping: 14 } }), [0, 1], [0, 100]);

  // Floating lines
  const lineY1 = interpolate(frame, [0, durationInFrames], [20, 80]);
  const lineY2 = interpolate(frame, [0, durationInFrames], [70, 25]);

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: `'${fontFamily}', sans-serif`, overflow: "hidden" }}>

      {/* Background glow */}
      <div style={{
        position: "absolute", left: "45%", top: "50%", width: "50%", height: "50%",
        borderRadius: "50%",
        background: `radial-gradient(circle, ${primaryColor}18, transparent)`,
        filter: "blur(80px)", transform: "translate(-50%,-50%)",
      }} />

      {/* Animated decorative lines */}
      <div style={{
        position: "absolute", left: "48%", top: `${lineY1}%`, width: "4%", height: 1,
        background: `${primaryColor}30`, transform: "translateX(-50%)",
      }} />
      <div style={{
        position: "absolute", left: "52%", top: `${lineY2}%`, width: "3%", height: 1,
        background: `${secondary}20`, transform: "translateX(-50%)",
      }} />

      <div style={{
        display: "flex", width: "100%", height: "100%",
        opacity: 1 - exitProg, transform: `scale(${1 - exitProg * 0.05})`,
      }}>

        {/* Left: Text */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "center", padding: "8% 5% 8% 8%",
          transform: `translateX(${leftX}px)`,
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20,
            opacity: interpolate(spring({ frame: frame - 12, fps }), [0, 1], [0, 0.7]),
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: primaryColor, boxShadow: `0 0 8px ${primaryColor}` }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: primaryColor, textTransform: "uppercase", letterSpacing: "0.15em" }}>
              {subheadline ? "Why it matters" : "Key insight"}
            </span>
          </div>

          <h2 style={{
            fontSize: Math.min(width * 0.045, 60), fontWeight: 800,
            color: textColor, margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em",
            opacity: interpolate(spring({ frame: frame - 10, fps, config: { damping: 14 } }), [0, 0.3, 1], [0, 0, 1]),
            transform: `translateY(${interpolate(spring({ frame: frame - 10, fps, config: { damping: 14 } }), [0, 1], [30, 0])}px)`,
          }}>
            {headline}
          </h2>

          <div style={{
            width: interpolate(spring({ frame: frame - 18, fps }), [0, 1], [0, 60]),
            height: 3, borderRadius: 2, marginTop: 20,
            background: `linear-gradient(90deg, ${primaryColor}, ${secondary})`,
          }} />
        </div>

        {/* Divider */}
        <div style={{
          width: 1, alignSelf: "center", height: `${divH}%`,
          background: `linear-gradient(180deg, transparent, ${primaryColor}33, transparent)`,
        }} />

        {/* Right: Image or abstract */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "5%", transform: `translateX(${rightX}px)`,
        }}>
          {imageUrl ? (
            <div style={{
              width: "88%", height: "78%", borderRadius: 24,
              overflow: "hidden", position: "relative",
              boxShadow: `0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px ${textColor}08`,
            }}>
              <Img src={imageUrl} style={{
                width: "110%", height: "110%", objectFit: "cover",
                marginLeft: "-5%", marginTop: "-5%",
                transform: `scale(${imgZoom}) rotate(${imgRotate}deg)`,
              }} />
              {/* Corner glow */}
              <div style={{
                position: "absolute", top: 0, right: 0, width: "40%", height: "40%",
                background: `radial-gradient(circle at top right, ${primaryColor}22, transparent)`,
              }} />
            </div>
          ) : (
            <div style={{ position: "relative", width: "80%", height: "70%" }}>
              {Array.from({ length: 5 }).map((_, i) => {
                const seed = i * 17;
                const sz = 60 + random(seed) * 100;
                const cx = 20 + random(seed + 1) * 60;
                const cy = 20 + random(seed + 2) * 60;
                const moveY = interpolate(frame, [0, durationInFrames], [cy, cy + (random(seed + 3) - 0.5) * 20]);
                return (
                  <div key={i} style={{
                    position: "absolute", left: `${cx}%`, top: `${moveY}%`,
                    width: sz, height: sz, borderRadius: random(seed + 4) > 0.5 ? "50%" : "20%",
                    border: `1.5px solid ${primaryColor}20`,
                    background: random(seed + 5) > 0.6 ? `${primaryColor}08` : "transparent",
                    transform: `translate(-50%,-50%) rotate(${interpolate(frame, [0, durationInFrames], [0, 90])}deg)`,
                  }} />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Particles */}
      {Array.from({ length: 20 }).map((_, i) => {
        const seed = i * 7 + 200;
        const drift = interpolate(frame, [0, durationInFrames], [0, -50 - random(seed) * 50]);
        return (
          <div key={i} style={{
            position: "absolute", left: `${random(seed + 1) * 100}%`, top: `${random(seed + 2) * 100}%`,
            width: 1.5 + random(seed + 3) * 2.5, height: 1.5 + random(seed + 3) * 2.5,
            borderRadius: "50%", backgroundColor: primaryColor,
            opacity: interpolate(frame, [0, 10, durationInFrames - 10, durationInFrames], [0, 0.15, 0.1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `translateY(${drift}px)`,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};
