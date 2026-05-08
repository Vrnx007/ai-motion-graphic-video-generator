import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { KineticHero } from "./KineticHero";
import { BentoGrid } from "./BentoGrid";
import { FeatureShowcase } from "./FeatureShowcase";
import { SplitScreen } from "./SplitScreen";
import { StatCounter } from "./StatCounter";
import { LogoReveal } from "./LogoReveal";

export interface TemplateProps {
  templateName: string;
  props: any;
}

export const TemplateRegistry: React.FC<TemplateProps> = ({ templateName, props }) => {
  switch (templateName) {
    case "KineticHero":
      return <KineticHero {...props} />;
    case "BentoGrid":
      return <BentoGrid {...props} />;
    case "FeatureShowcase":
      return <FeatureShowcase {...props} />;
    case "SplitScreen":
      return <SplitScreen {...props} />;
    case "StatCounter":
      return <StatCounter {...props} />;
    case "LogoReveal":
      return <LogoReveal {...props} />;
    default:
      // Fallback — render as KineticHero since it handles all basic props
      return <KineticHero {...props} />;
  }
};
