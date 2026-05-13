import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";

export interface TestimonialSpotlightProps {
  headline: string;
  subheadline?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  imageUrl?: string;
}

export const TestimonialSpotlight: React.FC<TestimonialSpotlightProps> = ({
  headline,
  subheadline,
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
  const card = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const scale = interpolate(card, [0, 1], [0.92, 1]);
  const glow = 0.35 + Math.sin(frame * 0.05) * 0.12;

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
          left: "50%",
          top: "42%",
          width: "min(88%, 920px)",
          transform: `translate(-50%, -50%) scale(${scale})`,
          padding: "48px 40px",
          borderRadius: 28,
          border: `1px solid ${textColor}18`,
          background: `linear-gradient(145deg, ${textColor}0d, ${primaryColor}12)`,
          boxShadow: `0 0 80px ${primaryColor}${Math.floor(glow * 100).toString(16)}`,
        }}
      >
        <div
          style={{
            fontSize: Math.min(42, width * 0.038),
            fontWeight: 800,
            color: textColor,
            lineHeight: 1.15,
            marginBottom: 20,
          }}
        >
          “{subheadline || headline}”
        </div>
        <div style={{ fontSize: 18, color: `${textColor}aa`, fontWeight: 600 }}>
          — {subheadline ? headline : "Customer"}
        </div>
        {imageUrl && (
          <Img
            src={imageUrl}
            style={{
              marginTop: 24,
              width: 72,
              height: 72,
              borderRadius: "50%",
              objectFit: "cover",
              border: `2px solid ${secondary}55`,
            }}
          />
        )}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 30%, ${primaryColor}20, transparent 45%)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
