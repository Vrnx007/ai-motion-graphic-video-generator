import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { prompt, duration: rawDuration, aspectVideo, brandKit, scene } = await req.json();

    const duration = Math.min(Math.max(Number(rawDuration) || 10, 3), 300);

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // Build brand injection block
    let brandBlock = "";
    if (brandKit) {
      const images = Array.isArray(brandKit.images) ? brandKit.images : [];
      
      // Proxy all image URLs through our API to bypass CORS
      const proxyUrl = (url: string) => {
        if (!url || url === "none") return "none";
        return `/api/image-proxy?url=${encodeURIComponent(url)}`;
      };
      const proxiedLogo = brandKit.logoUrl ? proxyUrl(brandKit.logoUrl) : "none";
      const proxiedImages = images.map((img: any) => ({
        ...img,
        url: proxyUrl(img.url),
      }));

      brandBlock = `

BRAND IDENTITY  USE THESE EXACTLY

Company Name: ${brandKit.headline || brandKit.name || ""}
Tagline: ${brandKit.subheadline || ""}
Primary Color: ${brandKit.colors?.primary || "#3B82F6"}
Secondary Color: ${brandKit.colors?.secondary || "#7C3AED"}
Accent Color: ${brandKit.colors?.accent || "#06B6D4"}
Full Palette: [${(brandKit.brandPalette || []).map((c: string) => `"${c}"`).join(", ")}]
Background: #FFFFFF (white  clean and professional)
Text Color: #1A1A2E (dark navy on white)
Font Family: "${brandKit.fonts?.heading || "Inter"}"
Motion Style: ${brandKit.style || "modern"} / ${brandKit.tone || "professional"}
CTA Text: "${brandKit.cta || "Get Started"}"
Logo URL: ${proxiedLogo}

BRAND IMAGES  THESE ARE PROXIED AND WILL RENDER. Use <Img> component:
${proxiedImages.length > 0 ? proxiedImages.map((img: any, i: number) =>
  `  Image ${i + 1}: "${img.url}"  ${img.alt || img.context || "brand visual"}`
).join("\n") : "  No brand images available  use abstract/geometric visuals instead"}

RULES FOR BRAND:
 Use the EXACT brand colors above  NOT random blue/purple.
 If logo URL exists, display it: <Img src="${proxiedLogo}" style={{width:100,height:100,objectFit:"contain"}} />
 If brand images exist, USE THEM. They are PROXIED and guaranteed to load.
 Apply the brand's font: fontFamily: '${brandKit.fonts?.heading || "Inter"}, sans-serif'
 Match the brand's tone: ${brandKit.tone || "professional"}
`;
    }

    // Build scene-specific instructions
    let sceneBlock = "";
    if (scene) {
      // Proxy scene image through our CORS-free proxy
      const sceneImgUrl = scene.imageUrl 
        ? `/api/image-proxy?url=${encodeURIComponent(scene.imageUrl)}`
        : "";
      sceneBlock = `

SCENE INSTRUCTIONS

Scene Type: ${scene.type}
Scene Title: ${scene.title}
On-Screen Text: "${scene.text}"
Visual Direction: ${scene.visual}
${sceneImgUrl ? `Featured Image: "${sceneImgUrl}"  this URL is PROXIED and will load. Make it the HERO of this scene: <Img src="${sceneImgUrl}" style={{width:"100%",height:"100%",objectFit:"cover"}} />` : ""}
Duration: ${duration} seconds (${duration * 30} frames)

Generate ONLY this single scene  it will be stitched with others.
`;
    }

    const useGodTemplates = process.env.USE_GOD_TEMPLATES === "true";

    let systemPrompt = "";

    if (useGodTemplates) {
      //  NEW: PARAMETRIC TEMPLATE ENGINE (JSON) 
      systemPrompt = `
You are an elite motion design Creative Director.
Your task is to select the perfect high-end video template and configure its props based on the user's request and brand identity.

AVAILABLE TEMPLATES:
1. "KineticHero"  Giant kinetic typography with word-by-word reveals, floating particles, gradient orbs.
   Best for: hook, intro, bold statements, opening scenes.
   Props: { headline (string, 2-5 impactful words), subheadline (string, 1-2 sentences), imageUrl (string, optional background image) }

2. "BentoGrid"  Apple-style grid of glassmorphism feature cards with staggered 3D scale reveals.
   Best for: features, demo, solution, product overview.
   Props: { headline (string), features (array of 3-4 short feature names), images (array of up to 4 image URLs) }

3. "FeatureShowcase"  Full-screen hero image with glassmorphism text overlay at bottom, Ken Burns zoom.
   Best for: demo, solution, product screenshots, visual proof.
   Props: { headline (string, key benefit or feature), subheadline (string, optional detail), imageUrl (string, REQUIRED  the hero image) }

4. "SplitScreen"  Left text / right image layout with slide-in panels and animated divider.
   Best for: problem, solution, comparison, before/after.
   Props: { headline (string, bold claim), subheadline (string, supporting detail), imageUrl (string, optional product image) }

5. "StatCounter"  Animated odometer-style number counters in glassmorphism cards with glow effects.
   Best for: social-proof, metrics, trust signals.
   Props: { headline (string, optional section title), stats (array of {value: "10K+", label: "Active Users"}, up to 4 items) }

6. "LogoReveal"  Cinematic logo entrance with expanding rings, particles, and CTA button.
   Best for: intro, outro, CTA, brand reveal.
   Props: { headline (string, brand or CTA headline), subheadline (string, optional), ctaText (string, optional button text), imageUrl (string, logo URL) }

${brandBlock}
${sceneBlock}

USER REQUEST:
Prompt: ${prompt}
Duration: ${duration} seconds
${scene?.templateName ? `REQUESTED TEMPLATE: "${scene.templateName}"  YOU MUST use this template.` : ""}

TEMPLATE SELECTION GUIDE:
- hook / intro  KineticHero or LogoReveal
- problem  SplitScreen
- solution / demo  FeatureShowcase or SplitScreen
- features  BentoGrid
- social-proof  StatCounter
- cta / outro  LogoReveal
- general  KineticHero

RULES:
1. ${scene?.templateName ? `Use the template "${scene.templateName}" as instructed.` : "Choose the BEST template for the scene type and content."}
2. Extract the best copy from the brand context or prompt. KEEP TEXT EXTREMELY SHORT AND PUNCHY.
3. If brand images are available, ALWAYS assign them to imageUrl or images props. DO NOT leave image props empty when images exist.
4. For StatCounter, invent realistic-sounding metrics if none are provided (e.g. "99.9%" uptime, "10K+" users).
5. Output EXACTLY valid JSON, nothing else. No markdown, no explanation.

OUTPUT FORMAT:
{
  "type": "template",
  "templateName": "...",
  "props": { ... }
}
      `;
    } else {
      //  LEGACY: GENERATIVE CODE ENGINE (RAW REACT) 
      systemPrompt = `
You are a WORLD-CLASS motion graphics designer at a top creative agency (Buck, ManvsMachine, Ordinary Folk).
You create STUNNING, VISUALLY RICH motion graphics using React + Remotion.

YOUR OUTPUT IS 90% VISUAL, 10% TEXT.
Think: animated geometric shapes, floating particles, morphing blobs, icon animations, gradient waves,
glassmorphism panels, kinetic typography, 3D parallax layers, pulsing rings, orbiting dots,
grid patterns, noise textures, light rays, lens flares  NOT PowerPoint slides with text.


HARD OUTPUT RULES

 Start EXACTLY with: const MyComposition = () => {
 Do NOT write any import statements.
 Do NOT write export default.
 Do NOT wrap in markdown fences.
 Use only the APIs listed below.


AVAILABLE APIs

Remotion (pre-injected, use directly):
  useCurrentFrame, useVideoConfig, spring, interpolate, interpolateColors,
  AbsoluteFill, Sequence, Series, Loop, Audio, Img, staticFile,
  Easing, random

Lucide icons (pre-injected  USE HEAVILY for visual elements):
  Cloud, Shield, Zap, Settings, Mail, Lock, User, Star, Heart, Globe,
  Search, Bell, Check, X, ArrowRight, Video, Monitor, Cpu, Database,
  Music, Activity, Play, Pause, FastForward, Rewind, Layers, Layout,
  MousePointer, Smartphone, Tablet, Laptop, Tv, Camera, Image, Gift,
  ShoppingCart, CreditCard, Wallet, Home, MapPin, Navigation, Compass,
  Sunrise, Sunset, Moon, Sun, Wind, Droplets, Flame, Leaf, Coffee,
  Pizza, Bike, Car, Plane, Anchor, BarChart, PieChart, TrendingUp,
  Briefcase, Rocket, Sparkles, Wand2, Lightbulb, PenTool, Hash,
  Info, AlertCircle, AlertTriangle, HelpCircle

Standard browser globals: Math, Array, Date, SVGElement, etc.


AUDIO  MANDATORY

RULE 1: <Audio> as VERY FIRST child inside outermost <AbsoluteFill>.
RULE 2: src MUST be a HARDCODED string literal.
RULE 3: volume={0.5}.

Audio URLs:
  Upbeat/Corporate   "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
  Cinematic/Epic      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
  Energetic/Dance     "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
  Lofi/Chill          "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
  Dramatic/Suspense   "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3"
  Happy/Playful       "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3"
  Peaceful/Nature     "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3"
  Sci-Fi/Tech         "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"

${brandBlock}
${sceneBlock}


 CRITICAL VISUAL DESIGN RULES 

1. VISUAL FIRST: The video is 90% animated graphics, 10% text. NEVER make text the hero.
2. CONTINUOUS MOTION: Every single frame must have something moving. No static moments.
   - Background: animated gradient shifts, moving mesh patterns, floating particles ALWAYS.
   - Mid-layer: geometric shapes rotating, morphing, orbiting, pulsing continuously.
   - Foreground: icons animating, images zooming/panning, text entering/exiting.
3. FAST PACING: Use multiple <Sequence> blocks. Each visual element should appear, animate, and exit within 2-4 seconds. Keep it FAST.
4. SCENE TRANSITIONS: Use scale-down + fade, wipe, or zoom-through transitions between sequences. NEVER just cut.

VISUAL ELEMENTS TO USE (pick 5+ per video):
   Floating particles with wobble motion (use random() for positions, Math.sin() for wobble)
   Rotating geometric shapes (squares, circles, triangles with continuous rotation)
   Gradient orbs that drift across screen (use interpolate on position)
   Glassmorphism panels (background: rgba, backdropFilter: blur)
   Animated Lucide icons  orbit them, pulse them, stagger-reveal arrays of them
   SVG paths and circles (use inline <svg> elements with animated stroke-dashoffset)
   Grid/dot patterns that shift (backgroundPosition animation)
   Pulsing rings expanding outward from center
   Light rays / diagonal streaks sweeping across

TEXT RULES:
   Maximum 5-7 WORDS per text element. NEVER paragraphs.
   Text enters with spring animation, stays 1-2 seconds, then EXITS (fade/slide out).
   Use bold, impactful words only. Think billboard, not paragraph.
   Make text glow with textShadow: "0 0 30px primaryColor"

${brandKit ? `
 BRAND IDENTITY  NON-NEGOTIABLE 
  PRIMARY COLOR: ${brandKit.colors?.primary}  USE THIS for accents, highlights, icons, shapes.
  SECONDARY COLOR: ${brandKit.colors?.secondary || brandKit.colors?.primary}  USE for gradients with primary.
  BACKGROUND: WHITE (#FFFFFF or #FAFAFA or #F8FAFC). Clean, classy, professional. NEVER dark/black.
  TEXT COLOR: #1A1A2E or #0F172A (dark navy/charcoal on white background).
  Font: ${brandKit.fonts?.heading || "Inter"}
  
  YOU MUST USE THESE EXACT BRAND COLORS. Do NOT invent random colors.
  Do NOT use generic blue, purple, teal, or neon colors.
  The only colors in this video should be: white bg + brand primary + brand secondary + dark text.` :
`COLOR PALETTE  PROFESSIONAL & CLASSY:
  Background: WHITE (#FFFFFF, #FAFAFA, or #F8FAFC). Clean, Apple-style.
  Accent: Pick ONE sophisticated brand color (NOT generic blue/red/green).
  Text: Dark charcoal (#1A1A2E or #0F172A) on white background.
  Style: Think Apple, Stripe, Linear  minimal, premium, classy.`}

${brandKit?.images?.length > 0 ? (() => {
  const pImages = brandKit.images.map((img: any) => ({
    ...img,
    url: `/api/image-proxy?url=${encodeURIComponent(img.url)}`,
  }));
  return `
 BRAND IMAGES  ABSOLUTELY MANDATORY 
You MUST display ALL of these images prominently in the video (URLs are PROXIED  guaranteed to load):
${pImages.map((img: any, i: number) => `  Scene ${i + 1}: <Img src="${img.url}" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:16}} />`).join("\n")}

HOW TO USE IMAGES:
- Display each image in a rounded-corner frame with subtle shadow
- Animate with smooth Ken Burns zoom (scale 1.05  1.0 over the scene duration)
- Add a slight tilt or parallax float animation
- Place them CENTER STAGE  images are the HERO, text is secondary
- Use at least 1 image per Sequence block
`;
})() : ""}

${brandKit?.logoUrl ? `
 LOGO  MUST APPEAR IN VIDEO 
LOGO URL (PROXIED): "/api/image-proxy?url=${encodeURIComponent(brandKit.logoUrl)}"
- Show the logo in the FIRST and LAST scene: <Img src="/api/image-proxy?url=${encodeURIComponent(brandKit.logoUrl)}" style={{width:120,height:120,objectFit:"contain"}} />
- Animate it: spring scale from 0  1, with a soft shadow
- The logo must be clearly visible
` : ""}


TECHNICAL RULES

CSS:
   NEVER mix 'background' and 'backgroundColor' on same element.
   Use style objects: style={{ transform: \`translateY(\${y}px)\` }}

Animations:
   const frame = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();
   spring({ frame, fps, config:{ damping:12, stiffness:100 } }) for natural motion
   interpolate(frame,[0,30],[0,1],{ extrapolateLeft:'clamp', extrapolateRight:'clamp' })
   Math.sin(frame * 0.05) for continuous wave/wobble motion
   random(seed) for deterministic randomness (particles, positions)

Images:
   Use <Img> (not <img>) for all images.
   Always animate with Ken Burns zoom + pan.
   NEVER use loremflickr.com.


USER REQUEST

Prompt   : ${prompt}
Duration : ${duration} seconds (= ${duration * 30} frames at 30 fps)
Aspect   : ${aspectVideo}

Create a STUNNING, agency-quality motion graphics video. Think: Apple keynote visuals, Stripe marketing videos, Linear product demos.
PRIORITIZE VISUAL RICHNESS AND CONTINUOUS MOTION. Minimize text. Make every frame beautiful.
      `;
    }

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    let text = response.text();

    const cleanCode = text
      .replace(/^```(?:jsx?|tsx?|javascript|typescript|json)?\s*\n?/gim, "")
      .replace(/\n?```\s*$/gim, "")
      .trim();

    console.log("Generated Code Length:", cleanCode.length);

    // If using God Templates, parse the JSON and inject brand colors
    if (useGodTemplates) {
      try {
        const parsed = JSON.parse(cleanCode);
        // Inject brand colors into props so templates can use them
        parsed.props = {
          ...parsed.props,
          primaryColor: brandKit?.colors?.primary || "#3B82F6",
          secondaryColor: brandKit?.colors?.secondary || "#7C3AED",
          backgroundColor: brandKit?.colors?.background || "#0F172A",
          textColor: brandKit?.colors?.text || "#FFFFFF",
          fontFamily: brandKit?.fonts?.heading || "Inter",
        };
        // Return stringified JSON as videoCode
        return NextResponse.json({ videoCode: JSON.stringify(parsed), duration });
      } catch (e) {
        console.error("Failed to parse God Template JSON:", e);
        // Fallback to simple error template
        const fallbackJSON = {
          type: "template",
          templateName: "KineticHero",
          props: {
            headline: "Error Parsing JSON",
            subheadline: "The AI returned invalid format.",
            primaryColor: "#ef4444", backgroundColor: "#000", textColor: "#fff", fontFamily: "Inter"
          }
        };
        return NextResponse.json({ videoCode: JSON.stringify(fallbackJSON), duration });
      }
    }

    return NextResponse.json({ videoCode: cleanCode, duration });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate video code." },
      { status: 500 }
    );
  }
}
