import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img } from "remotion";

export interface BentoGridProps {
  headline: string;
  features: string[]; // Up to 3 features
  images: string[];   // Up to 3 images
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

export const BentoGrid: React.FC<BentoGridProps> = ({
  headline,
  features = [],
  images = [],
  primaryColor,
  backgroundColor,
  textColor,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleScale = spring({ frame, fps, config: { damping: 12 } });
  const titleOpacity = interpolate(titleScale, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: `'${fontFamily}', sans-serif`, padding: "5%", display: "flex", flexDirection: "column" }}>
      
      {/* Header */}
      <div style={{ flex: "0 0 auto", textAlign: "center", marginBottom: "4%" }}>
        <h1 style={{ 
          fontSize: "4vw", 
          fontWeight: 800, 
          color: textColor,
          margin: 0,
          transform: `scale(${titleScale})`,
          opacity: titleOpacity
        }}>
          {headline}
        </h1>
      </div>

      {/* Grid Container */}
      <div style={{ 
        flex: 1, 
        display: "grid", 
        gridTemplateColumns: "repeat(3, 1fr)", 
        gridTemplateRows: "repeat(2, 1fr)", 
        gap: "2%",
      }}>
        
        {/* Main large cell */}
        <BentoCell 
          index={0}
          frame={frame}
          fps={fps}
          colSpan={2}
          rowSpan={2}
          text={features[0] || "Main Feature"}
          imageUrl={images[0]}
          color={primaryColor}
          textColor={textColor}
        />

        {/* Small cell top right */}
        <BentoCell 
          index={1}
          frame={frame}
          fps={fps}
          colSpan={1}
          rowSpan={1}
          text={features[1] || "Fast"}
          imageUrl={images[1]}
          color={`${primaryColor}33`} // 20% opacity
          textColor={textColor}
        />

        {/* Small cell bottom right */}
        <BentoCell 
          index={2}
          frame={frame}
          fps={fps}
          colSpan={1}
          rowSpan={1}
          text={features[2] || "Reliable"}
          imageUrl={images[2]}
          color={"rgba(255,255,255,0.05)"}
          textColor={textColor}
        />

      </div>
    </AbsoluteFill>
  );
};

// Helper component for individual bento cells
const BentoCell: React.FC<{
  index: number;
  frame: number;
  fps: number;
  colSpan: number;
  rowSpan: number;
  text: string;
  imageUrl?: string;
  color: string;
  textColor: string;
}> = ({ index, frame, fps, colSpan, rowSpan, text, imageUrl, color, textColor }) => {
  
  // Stagger animation based on index
  const scaleSpring = spring({
    frame: frame - (15 + index * 10),
    fps,
    config: { damping: 14, stiffness: 100 }
  });

  const translateY = interpolate(scaleSpring, [0, 1], [100, 0]);
  const opacity = interpolate(scaleSpring, [0, 0.5, 1], [0, 0, 1]);

  return (
    <div style={{
      gridColumn: `span ${colSpan}`,
      gridRow: `span ${rowSpan}`,
      backgroundColor: color,
      borderRadius: "2vw",
      overflow: "hidden",
      position: "relative",
      transform: `translateY(${translateY}px) scale(${interpolate(scaleSpring, [0,1], [0.9, 1])})`,
      opacity: opacity,
      border: "1px solid rgba(255,255,255,0.1)",
      display: "flex",
      alignItems: "flex-end",
      padding: "2vw",
      boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
    }}>
      
      {/* Background Image */}
      {imageUrl && (
        <AbsoluteFill>
          <Img 
            src={imageUrl} 
            style={{ 
              width: "100%", 
              height: "100%", 
              objectFit: "cover",
              transform: `scale(${interpolate(frame, [0, 300], [1.1, 1])})` // slow zoom out
            }} 
          />
          {/* Gradient overlay for text readability */}
          <div style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0, height: "50%",
            background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)"
          }} />
        </AbsoluteFill>
      )}

      {/* Text Content */}
      <h3 style={{ 
        position: "relative", 
        zIndex: 10, 
        margin: 0, 
        color: imageUrl ? "#FFF" : textColor,
        fontSize: colSpan === 2 ? "2.5vw" : "1.5vw",
        fontWeight: 700
      }}>
        {text}
      </h3>

    </div>
  );
};
