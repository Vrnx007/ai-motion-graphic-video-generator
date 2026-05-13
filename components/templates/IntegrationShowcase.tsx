import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, random } from "remotion";

export type IntegrationLogo = { name: string; imageUrl?: string };

export interface IntegrationShowcaseProps {
  headline: string;
  subheadline?: string;
  logos?: IntegrationLogo[];
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

export const IntegrationShowcase: React.FC<IntegrationShowcaseProps> = ({
  headline,
  subheadline,
  logos = [],
  primaryColor,
  secondaryColor,
  backgroundColor,
  textColor,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;
  const drift = interpolate(frame, [0, durationInFrames], [0, -40], { extrapolateRight: "clamp" });
  const pulse = 0.6 + Math.sin(frame * 0.06) * 0.08;

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
          inset: 0,
          background: `radial-gradient(circle at 30% 40%, ${primaryColor}22, transparent 55%), radial-gradient(circle at 70% 60%, ${secondary}18, transparent 50%)`,
          opacity: pulse,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "8%",
          top: "10%",
          right: "8%",
        }}
      >
        <div
          style={{
            fontSize: Math.min(52, width * 0.045),
            fontWeight: 900,
            color: textColor,
            letterSpacing: "-0.03em",
            marginBottom: 12,
            transform: `translateX(${spring({ frame, fps, config: { damping: 18, stiffness: 90 } }) * 8 - 8}px)`,
          }}
        >
          {headline}
        </div>
        {subheadline && (
          <div style={{ fontSize: 22, color: `${textColor}99`, maxWidth: "80%" }}>{subheadline}</div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: "6%",
          right: "6%",
          bottom: "12%",
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          transform: `translateX(${drift}px)`,
        }}
      >
        {(logos.length ? logos : [{ name: "Partner" }, { name: "Integrations" }, { name: "Ecosystem" }]).map(
          (logo, i) => {
            const delay = i * 5;
            const s = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 100 } });
            const y = interpolate(s, [0, 1], [40, 0]);
            const op = interpolate(s, [0, 1], [0, 1]);
            const wobble = Math.sin((frame + i * 12) * 0.04) * 4;
            return (
              <div
                key={`${logo.name}-${i}`}
                style={{
                  opacity: op,
                  transform: `translateY(${y + wobble}px)`,
                  padding: "14px 22px",
                  borderRadius: 16,
                  border: `1px solid ${textColor}22`,
                  background: `${textColor}0a`,
                  backdropFilter: "blur(12px)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  minWidth: 120,
                }}
              >
                {logo.imageUrl ? (
                  <Img
                    src={logo.imageUrl}
                    style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 8 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: `${primaryColor}33`,
                    }}
                  />
                )}
                <span style={{ color: textColor, fontWeight: 700, fontSize: 14 }}>{logo.name}</span>
              </div>
            );
          }
        )}
      </div>

      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${random("ix" + i) * 100}%`,
            top: `${random("iy" + i) * 100}%`,
            width: 3 + random("is" + i) * 4,
            height: 3 + random("is" + i) * 4,
            borderRadius: "50%",
            background: `${textColor}12`,
            transform: `translateY(${Math.sin(frame * 0.03 + i) * 10}px)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
