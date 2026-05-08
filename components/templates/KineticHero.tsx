import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";

export interface KineticHeroProps {
  headline: string;
  subheadline: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  imageUrl?: string;
}

export const KineticHero: React.FC<KineticHeroProps> = ({
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
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Animations
  const bgScale = interpolate(frame, [0, durationInFrames], [1.1, 1], { extrapolateRight: "clamp" });
  
  // Split headline by words
  const words = headline.split(" ");
  
  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: `'${fontFamily}', sans-serif`, overflow: "hidden" }}>
      
      {/* Background Image / Pattern */}
      {imageUrl ? (
        <AbsoluteFill style={{ opacity: 0.4 }}>
          <Img 
            src={imageUrl} 
            style={{ 
              width: "100%", 
              height: "100%", 
              objectFit: "cover", 
              transform: `scale(${bgScale})` 
            }} 
          />
          {/* Vignette */}
          <AbsoluteFill style={{ 
            background: `radial-gradient(circle, transparent 20%, ${backgroundColor} 90%)` 
          }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ 
          background: `radial-gradient(circle at top right, ${primaryColor}22 0%, transparent 60%)`,
          transform: `scale(${bgScale})`
        }} />
      )}

      {/* Content Container */}
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 10%" }}>
        
        {/* Kinetic Headline */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "40px" }}>
          {words.map((word, i) => {
            // Spring animation for each word, staggered
            const yOffset = spring({
              frame: frame - (i * 3), // stagger by 3 frames
              fps,
              config: { damping: 14, stiffness: 120, mass: 1.5 }
            });
            const yVal = interpolate(yOffset, [0, 1], [150, 0]);
            const opacityVal = interpolate(yOffset, [0, 0.5, 1], [0, 0, 1]);

            return (
              <div key={i} style={{ overflow: "hidden", paddingBottom: "10px" }}>
                <span 
                  style={{ 
                    display: "inline-block",
                    fontSize: "8vw", 
                    fontWeight: 900, 
                    color: textColor,
                    lineHeight: 1,
                    textTransform: "uppercase",
                    letterSpacing: "-0.02em",
                    transform: `translateY(${yVal}px)`,
                    opacity: opacityVal,
                    // Highlight the last word or specific words
                    ...(i === words.length - 1 ? { color: primaryColor } : {})
                  }}
                >
                  {word}
                </span>
              </div>
            );
          })}
        </div>

        {/* Subheadline Reveal */}
        {subheadline && (
          <div style={{ overflow: "hidden", maxWidth: "60%" }}>
            <p 
              style={{ 
                fontSize: "2vw", 
                fontWeight: 500, 
                color: textColor,
                opacity: interpolate(
                  spring({ frame: frame - 20, fps, config: { damping: 12 } }), 
                  [0, 1], 
                  [0, 0.8]
                ),
                transform: `translateX(${interpolate(
                  spring({ frame: frame - 20, fps, config: { damping: 12 } }), 
                  [0, 1], 
                  [-50, 0]
                )}px)`,
                margin: 0,
                lineHeight: 1.5,
                borderLeft: `4px solid ${primaryColor}`,
                paddingLeft: "20px"
              }}
            >
              {subheadline}
            </p>
          </div>
        )}

      </AbsoluteFill>
    </AbsoluteFill>
  );
};
