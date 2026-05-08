import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, random } from "remotion";

export interface StatCounterProps {
  stats: Array<{ value: string; label: string }>;
  headline?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

export const StatCounter: React.FC<StatCounterProps> = ({
  stats = [], headline, primaryColor, secondaryColor, backgroundColor, textColor, fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;

  // Parse numeric values from stat strings
  const parsedStats = stats.slice(0, 4).map((stat, i) => {
    const numMatch = stat.value.match(/([\d,.]+)/);
    const numericVal = numMatch ? parseFloat(numMatch[1].replace(/,/g, "")) : 0;
    const prefix = stat.value.slice(0, stat.value.indexOf(numMatch?.[0] || ""));
    const suffix = stat.value.slice((stat.value.indexOf(numMatch?.[0] || "") || 0) + (numMatch?.[0]?.length || 0));
    return { ...stat, numericVal, prefix, suffix, index: i };
  });

  // Title reveal
  const titleSpring = spring({ frame, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: `'${fontFamily}', sans-serif`, overflow: "hidden" }}>

      {/* Background radial */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, ${primaryColor}12, transparent 70%)`,
      }} />

      {/* Grid lines */}
      <AbsoluteFill style={{
        backgroundImage: `linear-gradient(${textColor}05 1px, transparent 1px), linear-gradient(90deg, ${textColor}05 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
        opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
      }} />

      {/* Content */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "5%" }}>

        {/* Headline */}
        {headline && (
          <h2 style={{
            fontSize: Math.min(width * 0.03, 40), fontWeight: 700,
            color: textColor, opacity: interpolate(titleSpring, [0, 0.5, 1], [0, 0, 0.6]),
            marginBottom: "5%", textTransform: "uppercase",
            letterSpacing: "0.15em",
            transform: `translateY(${interpolate(titleSpring, [0, 1], [20, 0])}px)`,
          }}>
            {headline}
          </h2>
        )}

        {/* Stats grid */}
        <div style={{
          display: "flex", gap: "3%", justifyContent: "center",
          width: "100%", flexWrap: "wrap",
        }}>
          {parsedStats.map((stat, i) => {
            const delay = 10 + i * 12;
            const statSpring = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 100 } });
            const countProgress = interpolate(frame - delay, [0, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const displayVal = Math.round(stat.numericVal * countProgress);
            const formattedVal = stat.numericVal >= 1000
              ? displayVal.toLocaleString()
              : displayVal.toString();

            const cardScale = interpolate(statSpring, [0, 1], [0.8, 1]);
            const cardOpacity = interpolate(statSpring, [0, 0.3, 1], [0, 0, 1]);
            const cardY = interpolate(statSpring, [0, 1], [60, 0]);

            return (
              <div key={i} style={{
                flex: "1 1 200px", maxWidth: 280,
                transform: `translateY(${cardY}px) scale(${cardScale})`,
                opacity: cardOpacity,
              }}>
                {/* Glassmorphism card */}
                <div style={{
                  background: `${textColor}05`,
                  backdropFilter: "blur(20px)",
                  border: `1px solid ${textColor}10`,
                  borderRadius: Math.min(width * 0.02, 24),
                  padding: "10% 8%",
                  textAlign: "center",
                  position: "relative", overflow: "hidden",
                }}>
                  {/* Glow line at top */}
                  <div style={{
                    position: "absolute", top: 0, left: "20%", right: "20%", height: 2,
                    background: `linear-gradient(90deg, transparent, ${primaryColor}88, transparent)`,
                    opacity: interpolate(statSpring, [0, 1], [0, 0.8]),
                  }} />

                  {/* Number */}
                  <div style={{
                    fontSize: Math.min(width * 0.06, 72), fontWeight: 900,
                    color: primaryColor, lineHeight: 1,
                    fontFeatureSettings: "'tnum'",
                    textShadow: `0 0 30px ${primaryColor}44`,
                  }}>
                    {stat.prefix}{formattedVal}{stat.suffix}
                  </div>

                  {/* Label */}
                  <div style={{
                    fontSize: Math.min(width * 0.014, 16), fontWeight: 500,
                    color: textColor, opacity: 0.6, marginTop: 12,
                    textTransform: "uppercase", letterSpacing: "0.1em",
                  }}>
                    {stat.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Particles */}
      {Array.from({ length: 20 }).map((_, i) => {
        const seed = i * 11;
        const drift = interpolate(frame, [0, durationInFrames], [0, -50 - random(seed) * 50]);
        return (
          <div key={i} style={{
            position: "absolute",
            left: `${random(seed + 1) * 100}%`,
            top: `${random(seed + 2) * 100}%`,
            width: 2 + random(seed + 3) * 3,
            height: 2 + random(seed + 3) * 3,
            borderRadius: "50%",
            backgroundColor: primaryColor,
            opacity: interpolate(frame, [0, 20, durationInFrames - 20, durationInFrames], [0, 0.15 + random(seed + 4) * 0.15, 0.15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `translateY(${drift}px)`,
          }} />
        );
      })}
    </AbsoluteFill>
  );
};
