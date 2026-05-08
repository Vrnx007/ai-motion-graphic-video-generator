import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";

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

  // Left panel slide in
  const leftSpring = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const leftX = interpolate(leftSpring, [0, 1], [-100, 0]);

  // Right panel slide in (delayed)
  const rightSpring = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 90 } });
  const rightX = interpolate(rightSpring, [0, 1], [100, 0]);
  const rightOpacity = interpolate(rightSpring, [0, 0.3, 1], [0, 0, 1]);

  // Text stagger
  const headlineSpring = spring({ frame: frame - 12, fps, config: { damping: 14, stiffness: 120 } });
  const subSpring = spring({ frame: frame - 22, fps, config: { damping: 14 } });

  // Ken Burns
  const kenBurns = interpolate(frame, [0, durationInFrames], [1.12, 1.0], { extrapolateRight: "clamp" });

  // Divider line animation
  const dividerHeight = interpolate(
    spring({ frame: frame - 5, fps, config: { damping: 12 } }),
    [0, 1], [0, 100]
  );

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: `'${fontFamily}', sans-serif`, overflow: "hidden" }}>

      {/* Background glow */}
      <div style={{
        position: "absolute", left: "40%", top: "30%",
        width: "40%", height: "40%", borderRadius: "50%",
        background: `radial-gradient(circle, ${primaryColor}20, transparent)`,
        filter: "blur(80px)",
      }} />

      <div style={{ display: "flex", width: "100%", height: "100%", position: "relative" }}>

        {/* Left: Text */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "center", padding: "8% 6% 8% 8%",
          transform: `translateX(${leftX}px)`,
        }}>
          {/* Small label */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24,
            opacity: interpolate(headlineSpring, [0, 1], [0, 0.7]),
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: primaryColor, boxShadow: `0 0 10px ${primaryColor}88`,
            }} />
            <span style={{
              fontSize: Math.min(width * 0.012, 14), fontWeight: 700,
              color: primaryColor, textTransform: "uppercase", letterSpacing: "0.15em",
            }}>
              {subheadline ? "Discover" : "Explore"}
            </span>
          </div>

          {/* Headline */}
          <h2 style={{
            fontSize: Math.min(width * 0.05, 72), fontWeight: 800,
            color: textColor, margin: 0, lineHeight: 1.1,
            letterSpacing: "-0.03em",
            opacity: interpolate(headlineSpring, [0, 0.3, 1], [0, 0, 1]),
            transform: `translateY(${interpolate(headlineSpring, [0, 1], [40, 0])}px)`,
          }}>
            {headline}
          </h2>

          {/* Accent line */}
          <div style={{
            width: interpolate(headlineSpring, [0, 1], [0, 80]),
            height: 3, borderRadius: 2, marginTop: 24,
            background: `linear-gradient(90deg, ${primaryColor}, ${secondary})`,
            boxShadow: `0 0 12px ${primaryColor}44`,
          }} />

          {/* Subheadline */}
          {subheadline && (
            <p style={{
              fontSize: Math.min(width * 0.018, 22), fontWeight: 400,
              color: textColor, opacity: interpolate(subSpring, [0, 0.3, 1], [0, 0, 0.7]),
              transform: `translateY(${interpolate(subSpring, [0, 1], [20, 0])}px)`,
              margin: "24px 0 0", lineHeight: 1.6, maxWidth: "90%",
            }}>
              {subheadline}
            </p>
          )}
        </div>

        {/* Center divider */}
        <div style={{
          width: 2, alignSelf: "center",
          height: `${dividerHeight}%`,
          background: `linear-gradient(180deg, transparent, ${primaryColor}44, transparent)`,
        }} />

        {/* Right: Image */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "6%",
          transform: `translateX(${rightX}px)`, opacity: rightOpacity,
        }}>
          {imageUrl ? (
            <div style={{
              width: "90%", height: "80%", borderRadius: Math.min(width * 0.025, 32),
              overflow: "hidden", position: "relative",
              boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${textColor}10`,
            }}>
              <Img src={imageUrl} style={{
                width: "100%", height: "100%", objectFit: "cover",
                transform: `scale(${kenBurns})`,
              }} />
              {/* Subtle gradient overlay */}
              <div style={{
                position: "absolute", inset: 0,
                background: `linear-gradient(135deg, ${primaryColor}15, transparent)`,
              }} />
            </div>
          ) : (
            /* Abstract visual placeholder */
            <div style={{
              width: "70%", height: "60%", borderRadius: Math.min(width * 0.03, 40),
              background: `linear-gradient(135deg, ${primaryColor}15, ${secondary}15)`,
              border: `1px solid ${textColor}10`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: `linear-gradient(135deg, ${primaryColor}, ${secondary})`,
                boxShadow: `0 0 40px ${primaryColor}44`,
                transform: `scale(${interpolate(frame % 90, [0, 45, 90], [1, 1.1, 1])})`,
              }} />
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
