import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { KineticHero } from "./KineticHero";
import { BentoGrid } from "./BentoGrid";
import { FeatureShowcase } from "./FeatureShowcase";
import { SplitScreen } from "./SplitScreen";
import { StatCounter } from "./StatCounter";
import { LogoReveal } from "./LogoReveal";
import { ProductOrbit3D } from "./ProductOrbit3D";
import { DemoBrowserWalkthrough } from "./DemoBrowserWalkthrough";
import { LottieOverlay } from "./LottieOverlay";
import { IntegrationShowcase } from "./IntegrationShowcase";
import { TestimonialSpotlight } from "./TestimonialSpotlight";
import { ComparisonSplit } from "./ComparisonSplit";
import { OrbFieldHero } from "./OrbFieldHero";
import { GlyphRhythm } from "./GlyphRhythm";

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
    case "ProductOrbit3D":
      return <ProductOrbit3D {...props} />;
    case "DemoBrowserWalkthrough":
      return <DemoBrowserWalkthrough {...props} />;
    case "LottieOverlay":
      return <LottieOverlay {...props} />;
    case "IntegrationShowcase":
      return <IntegrationShowcase {...props} />;
    case "TestimonialSpotlight":
      return <TestimonialSpotlight {...props} />;
    case "ComparisonSplit":
      return <ComparisonSplit {...props} />;
    case "OrbFieldHero":
      return <OrbFieldHero {...props} />;
    case "GlyphRhythm":
      return <GlyphRhythm {...props} />;
    default:
      // Fallback — render as KineticHero since it handles all basic props
      return <KineticHero {...props} />;
  }
};
