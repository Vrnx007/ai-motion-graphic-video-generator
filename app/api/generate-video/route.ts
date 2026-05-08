import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { prompt, duration: rawDuration, aspectVideo, brandKit, scene } = await req.json();

    const duration = Math.min(Math.max(Number(rawDuration) || 10, 3), 300);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-preview",
      generationConfig: {
        maxOutputTokens: 8192,
      }
    });

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

BRAND IDENTITY — USE THESE EXACTLY

Company Name: ${brandKit.headline || brandKit.name || ""}
Tagline: ${brandKit.subheadline || ""}
Primary Color: ${brandKit.colors?.primary || "#3B82F6"}
Secondary Color: ${brandKit.colors?.secondary || "#7C3AED"}
Accent Color: ${brandKit.colors?.accent || "#06B6D4"}
Full Palette: [${(brandKit.brandPalette || []).map((c: string) => `"${c}"`).join(", ")}]
Font Family: "${brandKit.fonts?.heading || "Inter"}"
Motion Style: ${brandKit.style || "modern"} / ${brandKit.tone || "professional"}
CTA Text: "${brandKit.cta || "Get Started"}"
Logo URL: ${proxiedLogo}

BRAND IMAGES — THESE ARE PROXIED AND WILL RENDER. Use <Img> component:
${proxiedImages.length > 0 ? proxiedImages.map((img: any, i: number) =>
  `  Image ${i + 1}: "${img.url}" — ${img.alt || img.context || "brand visual"}`
).join("\n") : "  No brand images available — use abstract/geometric visuals instead"}
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
${sceneImgUrl ? `Featured Image URL (PROXIED — will load): "${sceneImgUrl}"` : ""}
Duration: ${duration} seconds (${duration * 30} frames)

Generate ONLY this single scene — it will be stitched with others.
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
1. "KineticHero" — Giant kinetic typography with word-by-word reveals, floating particles, gradient orbs.
   Best for: hook, intro, bold statements, opening scenes.
   Props: { headline (string, 2-5 impactful words), subheadline (string, 1-2 sentences), imageUrl (string, optional background image) }

2. "BentoGrid" — Apple-style grid of glassmorphism feature cards with staggered 3D scale reveals.
   Best for: features, demo, solution, product overview.
   Props: { headline (string), features (array of 3-4 short feature names), images (array of up to 4 image URLs) }

3. "FeatureShowcase" — Full-screen hero image with glassmorphism text overlay at bottom, Ken Burns zoom.
   Best for: demo, solution, product screenshots, visual proof.
   Props: { headline (string, key benefit or feature), subheadline (string, optional detail), imageUrl (string, REQUIRED — the hero image) }

4. "SplitScreen" — Left text / right image layout with slide-in panels and animated divider.
   Best for: problem, solution, comparison, before/after.
   Props: { headline (string, bold claim), subheadline (string, supporting detail), imageUrl (string, optional product image) }

5. "StatCounter" — Animated odometer-style number counters in glassmorphism cards with glow effects.
   Best for: social-proof, metrics, trust signals.
   Props: { headline (string, optional section title), stats (array of {value: "10K+", label: "Active Users"}, up to 4 items) }

6. "LogoReveal" — Cinematic logo entrance with expanding rings, particles, and CTA button.
   Best for: intro, outro, CTA, brand reveal.
   Props: { headline (string, brand or CTA headline), subheadline (string, optional), ctaText (string, optional button text), imageUrl (string, logo URL) }

${brandBlock}
${sceneBlock}

USER REQUEST:
Prompt: ${prompt}
Duration: ${duration} seconds
${scene?.templateName ? `REQUESTED TEMPLATE: "${scene.templateName}" — YOU MUST use this template.` : ""}

TEMPLATE SELECTION GUIDE:
- hook / intro → KineticHero or LogoReveal
- problem → SplitScreen
- solution / demo → FeatureShowcase or SplitScreen
- features → BentoGrid
- social-proof → StatCounter
- cta / outro → LogoReveal
- general → KineticHero

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
      
      // Build the color/style context
      const primaryColor = brandKit?.colors?.primary || "#3B82F6";
      const secondaryColor = brandKit?.colors?.secondary || brandKit?.colors?.primary || "#7C3AED";
      const fontFamily = brandKit?.fonts?.heading || "Inter";
      
      // Build image instructions
      let imageInstructions = "";
      if (brandKit?.images?.length > 0) {
        const pImages = brandKit.images.map((img: any) => ({
          ...img,
          url: `/api/image-proxy?url=${encodeURIComponent(img.url)}`,
        }));
        imageInstructions = [
          "",
          "BRAND IMAGES (PROXIED — guaranteed to load):",
          ...pImages.map((img: any, i: number) => `  Image ${i + 1}: "${img.url}" — ${img.alt || img.context || "brand visual"}`),
          "",
          "HOW TO USE IMAGES:",
          "- Display as HERO VISUAL with device-frame treatment (rounded corners, shadow, border)",
          "- NEVER stretch to 100% width/height. Use max 80% width, centered.",
          "- Add premium shadow: boxShadow: '0 40px 80px rgba(0,0,0,0.5)'",
          "- Add border: border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20",
          "- Animate with spring entrance (scale 0.85→1) + subtle continuous float",
          "- Place text BELOW or BESIDE the image, NEVER on top of it",
          "",
        ].join("\n");
      }
      
      let logoInstructions = "";
      if (brandKit?.logoUrl) {
        const proxiedLogo = `/api/image-proxy?url=${encodeURIComponent(brandKit.logoUrl)}`;
        logoInstructions = [
          "",
          `LOGO (PROXIED): "${proxiedLogo}"`,
          "- Show in FIRST and LAST scene",
          "- Size: 48-80px, objectFit: 'contain'",
          "- Animate: spring scale from 0 → 1",
          "- NEVER make the logo larger than 80px",
          "",
        ].join("\n");
      }

      systemPrompt = [
        "You are an elite motion designer and cinematic filmmaker at a tier-1 agency (Buck, ManvsMachine, Ordinary Folk).",
        "You create WORLD-CLASS branded product showcase videos comparable to Apple launches, Stripe visuals, Linear promos, and Vercel launch videos.",
        "",
        "════════════════════════════════════════",
        " HARD OUTPUT RULES",
        "════════════════════════════════════════",
        "",
        " Start EXACTLY with: const MyComposition = () => {",
        " Do NOT write any import statements.",
        " Do NOT write export default.",
        " Do NOT wrap in markdown fences.",
        " KEEP CODE UNDER 500 LINES. Be efficient. Truncated code = broken video.",
        " ENSURE all string constants, braces, and JSX tags are properly closed.",
        " NEVER use base64 data strings or raw SVG <path> data longer than 50 chars.",
        "",
        "════════════════════════════════════════",
        " AVAILABLE APIs",
        "════════════════════════════════════════",
        "",
        "Remotion (pre-injected, use directly):",
        "  useCurrentFrame, useVideoConfig, spring, interpolate, interpolateColors,",
        "  AbsoluteFill, Sequence, Series, Loop, Audio, Img, staticFile, Easing, random",
        "",
        "Lucide icons (pre-injected — use as SMALL 16-24px ACCENTS only):",
        "  Cloud, Shield, Zap, Settings, Mail, Lock, User, Star, Heart, Globe,",
        "  Search, Bell, Check, X, ArrowRight, Video, Monitor, Cpu, Database,",
        "  Music, Activity, Play, Pause, FastForward, Rewind, Layers, Layout,",
        "  MousePointer, Smartphone, Tablet, Laptop, Tv, Camera, Image, Gift,",
        "  ShoppingCart, CreditCard, Wallet, Home, MapPin, Navigation, Compass,",
        "  Sunrise, Sunset, Moon, Sun, Wind, Droplets, Flame, Leaf, Coffee,",
        "  Pizza, Bike, Car, Plane, Anchor, BarChart, PieChart, TrendingUp,",
        "  Briefcase, Rocket, Sparkles, Wand2, Lightbulb, PenTool, Hash,",
        "  Info, AlertCircle, AlertTriangle, HelpCircle",
        "",
        "Standard browser globals: Math, Array, Date, etc.",
        "",
        "════════════════════════════════════════",
        " AUDIO — MANDATORY",
        "════════════════════════════════════════",
        "",
        "RULE 1: <Audio> as VERY FIRST child inside outermost <AbsoluteFill>.",
        "RULE 2: src MUST be a HARDCODED string literal.",
        "RULE 3: volume={0.3}.",
        "",
        "Audio URLs:",
        '  Cinematic    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"',
        '  Upbeat       "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"',
        '  Lofi/Chill   "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"',
        '  Tech/Sci-Fi  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"',
        "",
        brandBlock,
        sceneBlock,
        "",
        "════════════════════════════════════════",
        " CINEMATIC VISUAL DESIGN SYSTEM",
        "════════════════════════════════════════",
        "",
        "The output MUST feel cinematic, premium, and expensive.",
        "Think: Apple keynote, Stripe marketing, Linear promos, Arc browser trailers.",
        "NOT PowerPoint. NOT slideshows. NOT amateur.",
        "",
        "───── 1. BACKGROUND & COLOR SYSTEM ─────",
        "",
        `PRIMARY COLOR: ${primaryColor}`,
        `SECONDARY COLOR: ${secondaryColor}`,
        `FONT: '${fontFamily}, sans-serif'`,
        "",
        "BACKGROUND: Use a RICH DARK cinematic gradient. Example:",
        `  background: 'linear-gradient(135deg, #0a0a1a 0%, ${primaryColor}12 40%, #0a0a1a 100%)'`,
        "",
        "NEVER use plain white backgrounds — they look cheap and wash out screenshots.",
        "ALWAYS use dark, rich, cinematic backgrounds with subtle color tints from the brand palette.",
        "",
        "TEXT: #FFFFFF for headlines, rgba(255,255,255,0.6) for secondary text.",
        `GLOW: textShadow: '0 0 40px ${primaryColor}60' for premium headline glow.`,
        "",
        "───── 2. SCREENSHOT & IMAGE TREATMENT ─────",
        "",
        "DO NOT just zoom screenshots. DO NOT place them flat.",
        "DO NOT stretch images to fill entire screen.",
        "",
        "CORRECT screenshot treatment:",
        "- Frame in a premium device mockup style:",
        "  * borderRadius: 20",
        "  * border: '1px solid rgba(255,255,255,0.1)'",
        "  * boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'",
        "  * width: '75%' max, centered with margin auto",
        "",
        "- Animate cinematically:",
        "  * Enter: spring scale from 0.85 to 1.0 + translateY from 40 to 0",
        "  * Float: translateY with Math.sin(frame * 0.03) * 4 for subtle hover",
        "  * Optional: perspective(1200px) rotateY with subtle interpolated tilt",
        "",
        "- Place text BELOW or BESIDE the image — NEVER on top where it becomes unreadable",
        "",
        imageInstructions,
        logoInstructions,
        "",
        "───── 3. ICON RULES — CRITICAL ─────",
        "",
        "ICONS ARE SMALL ACCENTS. NEVER the main visual of any scene.",
        "NEVER render an icon larger than 28px.",
        "NEVER put icons in large circles/containers as hero elements.",
        "NEVER use icons as the centerpiece of a scene.",
        "",
        "CORRECT icon usage:",
        "- Tiny floating accents in background (16-20px, opacity 0.15-0.3)",
        "- Inline with feature labels: <Zap size={16} style={{marginRight:8}} /> Feature",
        "- Small bullets in feature cards",
        "- WRONG: <Globe size={120} /> as center — this looks TERRIBLE and amateur",
        "",
        "───── 4. TYPOGRAPHY SYSTEM ─────",
        "",
        `Headlines: fontSize: 56-72, fontWeight: 900, letterSpacing: '-0.03em', color: '#FFFFFF', fontFamily: '${fontFamily}, sans-serif'`,
        `  textShadow: '0 0 60px ${primaryColor}50' for premium glow`,
        "",
        "Subheads: fontSize: 22-28, fontWeight: 400, color: 'rgba(255,255,255,0.6)'",
        "",
        "Feature labels: fontSize: 14-18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em'",
        "",
        "MAX 5-7 WORDS per text element. Think billboard, not paragraph.",
        "Animate with staggered word reveals: each word delays by 3-4 frames, translateY 20→0 + opacity 0→1",
        "",
        "NEVER put dark text on dark backgrounds.",
        "ALWAYS ensure text is clearly readable against its background.",
        "",
        "───── 5. MOTION DESIGN ─────",
        "",
        "Every frame must have motion. Required techniques (use 4+ per scene):",
        "  * Spring animations: spring({ frame, fps, config:{ damping:14, stiffness:80 } })",
        "  * Continuous background float: Math.sin(frame * 0.02) for organic movement",
        "  * Staggered reveals: elements enter 4-6 frames apart",
        "  * Parallax: 2-3 layers at different speeds",
        "  * Gradient orbs: 200-400px blurred circles drifting slowly in background",
        "  * Glassmorphism panels: background:'rgba(255,255,255,0.05)', backdropFilter:'blur(20px)', border:'1px solid rgba(255,255,255,0.1)'",
        "",
        "TRANSITIONS between Sequences:",
        "  * Scale-down + fade (scene scales to 0.9 and fades)",
        "  * Slide in from right/bottom",
        "  * NEVER hard-cut between scenes",
        "",
        "───── 6. SCENE COMPOSITION ─────",
        "",
        "Every scene has 3 layers:",
        "  Layer 1 (BG):      Animated gradient + 15-20 floating particles (2-4px dots, opacity 0.1-0.2)",
        "  Layer 2 (Content):  Screenshots, text, feature cards — the hero",
        "  Layer 3 (Accents):  Small floating icons (16px, opacity 0.2), light rays, decorative lines",
        "",
        "PARTICLE PATTERN (use in every scene background):",
        "  {Array.from({length: 15}).map((_, i) => {",
        "    const x = random('x-'+i) * 100;",
        "    const y = random('y-'+i) * 100;",
        "    const s = 2 + random('s-'+i) * 3;",
        "    return <div key={i} style={{",
        "      position:'absolute', left: x+'%', top: y+'%',",
        "      width:s, height:s, borderRadius:'50%',",
        "      background:'rgba(255,255,255,0.1)',",
        "      transform: 'translateY('+(Math.sin(frame*0.02+i)*8)+'px)'",
        "    }} />;",
        "  })}",
        "",
        "───── 7. ANTI-PATTERNS — NEVER DO ─────",
        "",
        "✗ Giant Lucide icons as main visuals (amateur)",
        "✗ Icons in large white/gray circles (ugly)",
        "✗ Plain white backgrounds (cheap, washes out content)",
        "✗ Dark text on dark backgrounds (unreadable)",
        "✗ Screenshots stretched to fill entire screen",
        "✗ Same layout repeated across scenes (monotonous)",
        "✗ Mixing 'background' and 'backgroundColor' on same element (CSS conflict)",
        "✗ More than 7 words per text element",
        "✗ Static layouts with no motion",
        "",
        "════════════════════════════════════════",
        " TECHNICAL RULES",
        "════════════════════════════════════════",
        "",
        "CSS: NEVER mix 'background' and 'backgroundColor' on same element.",
        "Images: Use <Img> (not <img>). Always add borderRadius, shadow, border.",
        "NEVER use loremflickr.com. Use only brand-provided image URLs.",
        "const frame = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();",
        "",
        "════════════════════════════════════════",
        " USER REQUEST",
        "════════════════════════════════════════",
        "",
        `Prompt   : ${prompt}`,
        `Duration : ${duration} seconds (= ${duration * 30} frames at 30 fps)`,
        `Aspect   : ${aspectVideo}`,
        "",
        "Create a CINEMATIC, PREMIUM motion graphics video.",
        "Every frame must be visually stunning. The viewer should think: 'This looks expensive.'",
      ].join("\n");
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
