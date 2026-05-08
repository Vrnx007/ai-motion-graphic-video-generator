import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { KineticHero } from "./KineticHero";
import { BentoGrid } from "./BentoGrid";

export interface TemplateProps {
  templateName: string;
  props: any;
}

export const TemplateRegistry: React.FC<TemplateProps> = ({ templateName, props }) => {
  const { width, height } = useVideoConfig();

  // Route to the correct God Template
  switch (templateName) {
    case "KineticHero":
      return <KineticHero {...props} />;
    case "BentoGrid":
      return <BentoGrid {...props} />;
    default:
      // Fallback if template name is unknown
      return (
        <AbsoluteFill style={{ backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center" }}>
          <div style={{ color: "white", fontSize: 40, fontFamily: "Inter, sans-serif" }}>
            Template "{templateName}" not found.
          </div>
        </AbsoluteFill>
      );
  }
};
