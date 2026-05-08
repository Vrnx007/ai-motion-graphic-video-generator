import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, random } from "remotion";

export interface BentoGridProps {
  headline: string;
  features: string[];
  images: string[];
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

export const BentoGrid: React.FC<BentoGridProps> = ({
  headline, features = [], images = [], primaryColor, secondaryColor,
  backgroundColor, textColor, fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;

  // Title animation
  const titleSpring = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
  const titleY = interpolate(titleSpring, [0, 1], [60, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 0.3, 1], [0, 0, 1]);

  // Ensure we have exactly 4 cells
  const cells = [
    { text: features[0] || "Core Feature", image: images[0], span: "large" },
    { text: features[1] || "Fast & Reliable", image: images[1], span: "small" },
    { text: features[2] || "Secure", image: images[2], span: "small" },
    { text: features[3] || features[0] || "Modern Design", image: images[3] || images[0], span: "wide" },
  ];

  return (
    <AbsoluteFill style={{
      backgroundColor,
      fontFamily: `'${fontFamily}', Inter, sans-serif`,
      padding: "5%",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* Background gradient orb */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        width: "80%", height: "80%",
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        background: `radial-gradient(circle, ${primaryColor}15 0%, transparent 70%)`,
        filter: "blur(60px)",
      }} />

      {/* Title */}
      <div style={{
        textAlign: "center", marginBottom: "3%", position: "relative", zIndex: 10,
        transform: `translateY(${titleY}px)`, opacity: titleOpacity,
      }}>
        <h1 style={{
          fontSize: Math.min(width * 0.04, 56), fontWeight: 800,
          color: textColor, margin: 0, letterSpacing: "-0.02em",
        }}>
          {headline}
        </h1>
        <div style={{
          width: interpolate(titleSpring, [0, 1], [0, 80]),
          height: 3, borderRadius: 2, margin: "12px auto 0",
          background: `linear-gradient(90deg, ${primaryColor}, ${secondary})`,
          boxShadow: `0 0 15px ${primaryColor}44`,
        }} />
      </div>

      {/* Bento Grid */}
      <div style={{
        flex: 1, display: "grid", position: "relative", zIndex: 10,
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(2, 1fr)",
        gap: "1.5%",
      }}>
        {cells.map((cell, i) => {
          const cellSpring = spring({
            frame: frame - (12 + i * 8),
            fps,
            config: { damping: 16, stiffness: 100, mass: 1.1 }
          });
          const scale = interpolate(cellSpring, [0, 1], [0.85, 1]);
          const opacity = interpolate(cellSpring, [0, 0.3, 1], [0, 0, 1]);
          const y = interpolate(cellSpring, [0, 1], [60, 0]);

          // Image Ken Burns zoom
          const imgScale = interpolate(frame, [0, durationInFrames], [1.15, 1.0], { extrapolateRight: "clamp" });

          const gridColumn = i === 0 ? "span 2" : i === 3 ? "span 3" : "span 1";
          const gridRow = i === 0 ? "span 2" : "span 1";

          return (
            <div key={i} style={{
              gridColumn, gridRow,
              borderRadius: Math.min(width * 0.02, 24),
              overflow: "hidden", position: "relative",
              transform: `translateY(${y}px) scale(${scale})`,
              opacity,
              // Glassmorphism
              background: cell.image ? "transparent" : `${textColor}06`,
              backdropFilter: cell.image ? "none" : "blur(20px)",
              border: `1px solid ${textColor}12`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 ${textColor}08`,
              display: "flex", alignItems: "flex-end", padding: "4%",
            }}>

              {/* Background Image */}
              {cell.image && (
                <AbsoluteFill>
                  <Img src={cell.image} style={{
                    width: "100%", height: "100%", objectFit: "cover",
                    transform: `scale(${imgScale})`,
                  }} />
                  {/* Gradient overlay */}
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0, height: "70%",
                    background: `linear-gradient(to top, ${backgroundColor}ee, ${backgroundColor}88, transparent)`,
                  }} />
                </AbsoluteFill>
              )}

              {/* Glow accent line at top */}
              <div style={{
                position: "absolute", top: 0, left: "10%", right: "10%", height: 2,
                background: `linear-gradient(90deg, transparent, ${primaryColor}66, transparent)`,
                opacity: interpolate(cellSpring, [0, 1], [0, 0.6]),
              }} />

              {/* Text */}
              <div style={{ position: "relative", zIndex: 10, width: "100%" }}>
                {i === 0 && (
                  <div style={{
                    display: "inline-block", padding: "4px 12px", borderRadius: 8,
                    background: `${primaryColor}22`, border: `1px solid ${primaryColor}44`,
                    marginBottom: 12, fontSize: Math.min(width * 0.012, 14),
                    fontWeight: 700, color: primaryColor, textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}>
                    Featured
                  </div>
                )}
                <h3 style={{
                  margin: 0, color: textColor,
                  fontSize: i === 0 ? Math.min(width * 0.028, 36) : i === 3 ? Math.min(width * 0.022, 28) : Math.min(width * 0.018, 22),
                  fontWeight: 700, lineHeight: 1.3,
                  textShadow: `0 2px 8px rgba(0,0,0,0.5)`,
                }}>
                  {cell.text}
                </h3>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
