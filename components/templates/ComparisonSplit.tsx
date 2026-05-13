import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";

export interface ComparisonSplitProps {
  headline: string;
  subheadline?: string;
  leftLabel?: string;
  rightLabel?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  imageUrl?: string;
}

export const ComparisonSplit: React.FC<ComparisonSplitProps> = ({
  headline,
  subheadline,
  leftLabel = "Before",
  rightLabel = "After",
  primaryColor,
  secondaryColor,
  backgroundColor,
  textColor,
  fontFamily,
  imageUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;
  const split = spring({ frame: frame - 3, fps, config: { damping: 18, stiffness: 90 } });
  const x = interpolate(split, [0, 1], [width * 0.5, width * 0.5 - 1]);
  const leftIn = spring({ frame, fps, config: { damping: 16, stiffness: 85 } });
  const rightIn = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 85 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        fontFamily: `'${fontFamily}', sans-serif`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "8%",
          top: "10%",
          right: "8%",
        }}
      >
        <div style={{ fontSize: Math.min(48, width * 0.042), fontWeight: 900, color: textColor }}>
          {headline}
        </div>
        {subheadline && (
          <div style={{ marginTop: 10, fontSize: 20, color: `${textColor}99` }}>{subheadline}</div>
        )}
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: "32%", bottom: 0, display: "flex" }}>
        <div
          style={{
            flex: 1,
            padding: "6% 8%",
            background: `${textColor}06`,
            transform: `translateX(${interpolate(leftIn, [0, 1], [-40, 0])}px)`,
            opacity: leftIn,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: `${textColor}66`, letterSpacing: "0.2em" }}>
            {leftLabel.toUpperCase()}
          </div>
          <div style={{ marginTop: 16, fontSize: 22, color: `${textColor}cc` }}>Pain, cost, chaos</div>
        </div>
        <div
          style={{
            flex: 1,
            padding: "6% 8%",
            background: `${primaryColor}12`,
            transform: `translateX(${interpolate(rightIn, [0, 1], [40, 0])}px)`,
            opacity: rightIn,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: textColor, letterSpacing: "0.2em" }}>
            {rightLabel.toUpperCase()}
          </div>
          <div style={{ marginTop: 16, fontSize: 22, color: textColor }}>Clarity, speed, calm</div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: x,
          top: "32%",
          bottom: 0,
          width: 4,
          background: `linear-gradient(180deg, ${primaryColor}, ${secondary})`,
          borderRadius: 4,
          boxShadow: `0 0 24px ${primaryColor}88`,
        }}
      />

      {imageUrl && (
        <Img
          src={imageUrl}
          style={{
            position: "absolute",
            right: "8%",
            bottom: "10%",
            width: "min(38%, 420px)",
            borderRadius: 20,
            border: `1px solid ${textColor}22`,
            boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
            opacity: interpolate(frame, [12, 28], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(frame, [12, 28], [24, 0], { extrapolateRight: "clamp" })}px)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
