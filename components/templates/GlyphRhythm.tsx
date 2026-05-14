import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, random } from "remotion";

export interface GlyphRhythmProps {
  headline: string;
  subheadline?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

export const GlyphRhythm: React.FC<GlyphRhythmProps> = ({
  headline,
  subheadline,
  primaryColor,
  secondaryColor,
  backgroundColor,
  textColor,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const secondary = secondaryColor || primaryColor;

  const barCount = 14;
  const barW = Math.min(36, width / (barCount + 6));

  const titleSpring = spring({ frame: frame - 5, fps, config: { damping: 16, stiffness: 120 } });
  const titleOp = interpolate(titleSpring, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        fontFamily: `'${fontFamily}', sans-serif`,
        background: `linear-gradient(165deg, ${backgroundColor} 0%, #020617 55%, ${primaryColor}12 100%)`,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill style={{ opacity: 0.35 }}>
        {Array.from({ length: 24 }).map((_, i) => {
          const x = random(`grx-${i}`) * width;
          const y = random(`gry-${i}`) * height;
          const w = 2 + random(`grw-${i}`) * 3;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: w,
                height: w,
                borderRadius: 2,
                background: i % 2 === 0 ? primaryColor : secondary,
                opacity: 0.12 + random(`gro-${i}`) * 0.1,
                transform: `translateY(${Math.sin(frame * 0.05 + i) * 10}px)`,
              }}
            />
          );
        })}
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "18%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "flex-end",
          gap: barW * 0.35,
          height: height * 0.32,
        }}
      >
        {Array.from({ length: barCount }).map((_, i) => {
          const hBase = 0.25 + random(`gbh-${i}`) * 0.65;
          const wave = Math.sin(frame * 0.08 + i * 0.45) * 0.12;
          const h = Math.min(1, Math.max(0.15, hBase + wave));
          const spr = spring({ frame: frame - i * 2, fps, config: { damping: 12, stiffness: 90 } });
          const scaleY = interpolate(spr, [0, 1], [0.05, h]);
          const col = i % 3 === 0 ? primaryColor : i % 3 === 1 ? secondary : textColor;
          return (
            <div
              key={i}
              style={{
                width: barW,
                height: height * 0.3 * scaleY,
                borderRadius: barW / 2,
                background: `linear-gradient(to top, ${col}99, ${col}22)`,
                boxShadow: `0 0 24px ${col}44`,
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          top: "14%",
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 10%",
          opacity: titleOp,
        }}
      >
        <div
          style={{
            fontSize: Math.min(52, width / 15),
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: textColor,
            textShadow: `0 0 40px ${primaryColor}55`,
          }}
        >
          {headline}
        </div>
        {subheadline ? (
          <div style={{ marginTop: 12, fontSize: Math.min(18, width / 48), color: `${textColor}99` }}>
            {subheadline}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
