import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 120;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Models in priority order — falls back if primary is overloaded
const MODEL_CHAIN = ["gemini-3-flash-preview"];

async function generateWithRetry(prompt: string, maxRetries = 3): Promise<string> {
  for (const modelName of MODEL_CHAIN) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { maxOutputTokens: 8192 },
    });
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[generate-video] Trying ${modelName} (attempt ${attempt + 1})`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (err: any) {
        const status = err?.status || err?.httpStatusCode || 0;
        const isRetryable = status === 503 || status === 429 || err?.message?.includes("503") || err?.message?.includes("429") || err?.message?.includes("high demand") || err?.message?.includes("RESOURCE_EXHAUSTED");
        if (isRetryable && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.log(`[generate-video] ${modelName} returned ${status}, retrying in ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (isRetryable) {
          console.log(`[generate-video] ${modelName} exhausted retries, trying next model...`);
          break; // try next model
        }
        throw err; // non-retryable error
      }
    }
  }
  throw new Error("All AI models are currently overloaded. Please try again in a minute.");
}

export async function POST(req: Request) {
  try {
    const { prompt, duration: rawDuration, aspectVideo, brandKit, scene } = await req.json();

    const duration = Math.min(Math.max(Number(rawDuration) || 10, 3), 300);

    // Build brand injection block
    let brandBlock = "";
    if (brandKit) {
      const images = Array.isArray(brandKit.images) ? brandKit.images : [];
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
Aesthetic: ${brandKit.aesthetic || "AUTO"}
CTA Text: "${brandKit.cta || "Get Started"}"
Logo URL: ${proxiedLogo}
BRAND IMAGES — PROXIED AND WILL RENDER:
${proxiedImages.length > 0 ? proxiedImages.map((img: any, i: number) =>
  `  Image ${i + 1}: "${img.url}" — ${img.alt || img.context || "brand visual"}`
).join("\n") : "  No brand images available"}
`;
    }

    // Build scene-specific instructions
    let sceneBlock = "";
    if (scene) {
      const sceneImgUrl = scene.imageUrl 
        ? `/api/image-proxy?url=${encodeURIComponent(scene.imageUrl)}`
        : "";
      sceneBlock = `
SCENE INSTRUCTIONS
Scene Type: ${scene.type}
Scene Title: ${scene.title}
On-Screen Text: "${scene.text}"
Visual Direction: ${scene.visual}
${sceneImgUrl ? `Featured Image URL (PROXIED): "${sceneImgUrl}"` : ""}
Duration: ${duration} seconds (${duration * 30} frames)
Generate ONLY this single scene — it will be stitched with others.
`;
    }

    const useGodTemplates = process.env.USE_GOD_TEMPLATES === "true";
    let systemPrompt = "";

    if (useGodTemplates) {
      systemPrompt = `
You are an elite motion design Creative Director.
Your task is to select the perfect high-end video template and configure its props based on the user's request and brand identity.

MOTION DENSITY: Favor layered, continuous animation — parallax, staggered reveals, gradient shifts, subtle scale breathing, drifting light orbs, and micro-easing on every prop that can move. Avoid static layouts; every scene should feel "alive" like a top-tier SaaS launch film.

AVAILABLE TEMPLATES:
1. "KineticHero" — Giant kinetic typography with word-by-word reveals, floating particles, gradient orbs.
   Best for: hook, intro, bold statements, opening scenes.
   Props: { headline (string, 2-5 impactful words), subheadline (string, 1-2 sentences), imageUrl (string, optional background image) }

2. "BentoGrid" — Apple-style grid of glassmorphism feature cards with staggered 3D scale reveals.
   Best for: features, demo, solution, product overview.
   Props: { headline (string), features (array of 3-4 short feature names), images (array of up to 4 image URLs) }

3. "FeatureShowcase" — Full-screen hero image with glassmorphism text overlay at bottom, Ken Burns zoom.
   Best for: demo, solution, product screenshots, visual proof.
   Props: { headline (string, key benefit or feature), subheadline (string, optional detail), imageUrl (string, REQUIRED) }

4. "SplitScreen" — Left text / right image layout with slide-in panels and animated divider.
   Best for: problem, solution, comparison, before/after.
   Props: { headline (string, bold claim), subheadline (string, supporting detail), imageUrl (string, optional) }

5. "StatCounter" — Animated odometer-style number counters in glassmorphism cards with glow effects.
   Best for: social-proof, metrics, trust signals.
   Props: { headline (string, optional), stats (array of {value: "10K+", label: "Active Users"}, up to 4) }

6. "LogoReveal" — Cinematic logo entrance with expanding rings, particles, and CTA button.
   Best for: intro, outro, CTA, brand reveal.
   Props: { headline (string), subheadline (string, optional), ctaText (string, optional), imageUrl (string, logo URL) }

7. "ProductOrbit3D" — 3D floating product slab with subtle camera dolly and rotation (WebGL).
   Best for: premium hero, hardware, flagship moment, "wow" tech shots.
   Props: { headline (string), subheadline (string, optional), primaryColor (string, hex from brand) }

8. "DemoBrowserWalkthrough" — Browser chrome + animated cursor over a screenshot (2D, SaaS demo).
   Best for: UI walkthrough, feature tour, click path storytelling.
   Props: { headline (string), subheadline (string, optional), imageUrl (string, screenshot URL) }

9. "LottieOverlay" — Full-frame Lottie motion graphic (when you have valid Lottie JSON).
   Best for: logo sting, icon burst, pre-designed motion from designers.
   Props: { headline (string, optional), animationData (object, REQUIRED — valid Lottie JSON). If you cannot supply JSON, do NOT pick this template. }

${brandBlock}
${sceneBlock}

USER REQUEST:
Prompt: ${prompt}
Duration: ${duration} seconds
${scene?.templateName ? `REQUESTED TEMPLATE: "${scene.templateName}" — YOU MUST use this template.` : ""}

RULES:
1. ${scene?.templateName ? `Use the template "${scene.templateName}" as instructed.` : "Choose the BEST template for the scene type and content."}
2. Extract the best copy from the brand context or prompt. KEEP TEXT EXTREMELY SHORT AND PUNCHY.
3. If brand images are available, ALWAYS assign them to imageUrl or images props.
4. For StatCounter, invent realistic-sounding metrics if none are provided.
5. Output EXACTLY valid JSON, nothing else. No markdown, no explanation.

OUTPUT FORMAT:
{
  "type": "template",
  "templateName": "...",
  "props": { ... }
}
      `;
    } else {
      const primaryColor = brandKit?.colors?.primary || "#3B82F6";
      const secondaryColor = brandKit?.colors?.secondary || brandKit?.colors?.primary || "#7C3AED";
      const fontFamily = brandKit?.fonts?.heading || "Inter";
      
      let imageInstructions = "";
      if (brandKit?.images?.length > 0) {
        const pImages = brandKit.images.map((img: any) => ({
          ...img,
          url: `/api/image-proxy?url=${encodeURIComponent(img.url)}`,
        }));
        imageInstructions = [
          "BRAND IMAGES (PROXIED — guaranteed to load):",
          ...pImages.map((img: any, i: number) => `  Image ${i + 1}: "${img.url}" — ${img.alt || img.context || "brand visual"}`),
          "",
          "HOW TO USE IMAGES:",
          "- Display as HERO VISUAL with device-frame treatment (rounded corners, shadow, border)",
          "- NEVER stretch to 100% width/height. Use max 80% width, centered.",
          "- Add premium shadow and border treatment",
          "- Animate with spring entrance (scale 0.85→1) + subtle continuous float",
          "- Place text BELOW or BESIDE the image, NEVER on top of it",
        ].join("\n");
      }
      
      let logoInstructions = "";
      if (brandKit?.logoUrl) {
        const proxiedLogo = `/api/image-proxy?url=${encodeURIComponent(brandKit.logoUrl)}`;
        logoInstructions = [
          `LOGO (PROXIED): "${proxiedLogo}"`,
          "- Show in FIRST and LAST scene, size: 48-80px, objectFit: 'contain'",
          "- Animate: spring scale from 0 → 1. NEVER larger than 80px.",
        ].join("\n");
      }

      const promptParts = [
        // ═══ IDENTITY ═══
        "You are an elite motion designer, creative director, SaaS launch filmmaker, and cinematic UI animator.",
        "You create WORLD-CLASS branded product showcase videos comparable to:",
        "  Apple product launches, Stripe product visuals, Linear promo videos,",
        "  Framer website motion, Arc browser trailers, Vercel launch videos.",
        "",
        "Your job is NOT to create generic slideshow animations.",
        "The final output MUST feel: cinematic, premium, modern, intentional, polished, smooth, visually rich, emotionally engaging.",
        "",

        // ═══ HARD OUTPUT RULES ═══
        "════════════════════════════════════════",
        " HARD OUTPUT RULES",
        "════════════════════════════════════════",
        "",
        " Start EXACTLY with: const MyComposition = () => {",
        " Do NOT write any import statements.",
        " Do NOT write export default.",
        " Do NOT wrap in markdown fences.",
        " KEEP CODE UNDER 500 LINES. Truncated code = broken video.",
        " ENSURE all string constants, braces, and JSX tags are properly closed.",
        " NEVER use base64 data or raw SVG <path> data longer than 50 chars.",
        "",

        // ═══ AVAILABLE APIs ═══
        "════════════════════════════════════════",
        " AVAILABLE APIs",
        "════════════════════════════════════════",
        "",
        "Remotion (pre-injected): useCurrentFrame, useVideoConfig, spring, interpolate, interpolateColors,",
        "  AbsoluteFill, Sequence, Series, Loop, Audio, Img, staticFile, Easing, random",
        "",
        "Lucide icons (SMALL 16-24px ACCENTS only — NEVER as main visuals):",
        "  Cloud, Shield, Zap, Settings, Mail, Lock, User, Star, Heart, Globe, Search, Bell, Check, X,",
        "  ArrowRight, Video, Monitor, Cpu, Database, Music, Activity, Play, Pause, Layers, Layout,",
        "  Smartphone, Tablet, Laptop, Camera, Image, ShoppingCart, Home, MapPin, BarChart, PieChart,",
        "  TrendingUp, Briefcase, Rocket, Sparkles, Wand2, Lightbulb, PenTool, Info, AlertCircle",
        "",

        // ═══ AUDIO & SOUND DESIGN ═══
        "════════════════════════════════════════",
        " SOUND DESIGN (SFX & MUSIC) — MANDATORY",
        "════════════════════════════════════════",
        "",
        "1. BACKGROUND MUSIC:",
        "  Must have ONE <Audio> as VERY FIRST child inside outermost <AbsoluteFill>.",
        '  Cinematic: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"',
        '  Upbeat:    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"',
        '  Tech:      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"',
        "  volume={0.2} to keep it subtle.",
        "",
        "2. SOUND EFFECTS (SFX) — CRITICAL:",
        "  You MUST include SFX to make the video feel high-end.",
        "  - WHOOSH: Use for entrances, fast translations, or new screens sliding in.",
        '    URL: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"',
        "  - UI CLICK: Use when a cursor clicks, a button highlights, or a toggle activates.",
        '    URL: "https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3"',
        "",
        "  HOW TO USE SFX: Place multiple <Audio> tags at the END of the <Sequence> or <AbsoluteFill> and use `startFrom` or `endAt` if necessary, but PREFERRED is wrapping them in `<Sequence from={X}>` to trigger them at specific frames.",
        "  Example: <Sequence from={15} durationInFrames={30}><Audio src=\"WHOOSH_URL\" volume={0.5}/></Sequence>",
        "",

        // ═══ BRAND + SCENE CONTEXT ═══
        brandBlock,
        sceneBlock,
        "",

        // ═══ 1. BACKGROUND & COLOR SYSTEM ═══
        "════════════════════════════════════════",
        " CINEMATIC VISUAL DESIGN SYSTEM",
        "════════════════════════════════════════",
        "",
        "───── 1. BACKGROUND & COLOR (V2 PREMIUM AESTHETIC) ─────",
        `PRIMARY: ${primaryColor}   SECONDARY: ${secondaryColor}   FONT: '${fontFamily}, sans-serif'`,
        `AESTHETIC INSTRUCTION: ${brandKit?.aesthetic || "AUTO"}`,
        "",
        "CRITICAL COLOR RULE: If Aesthetic is 'AUTO', generate a PREMIUM, BRIGHT, highly-saturated Stripe-esque aesthetic. DO NOT default to dark mode unless explicitly asked.",
        `LIGHT MODE: background: 'linear-gradient(135deg, #ffffff 0%, ${primaryColor}15 100%)'`,
        `DARK MODE: background: 'linear-gradient(135deg, #0a0a1a 0%, ${primaryColor}20 100%)'`,
        "Use LUMINOUS radial gradients or glassmorphism containers to create depth.",
        "TEXT: #0f172a for Light mode, #FFFFFF for Dark mode. Use high-contrast for readability.",
        "",

        // ═══ 2. SCREENSHOT ANIMATION — ADVANCED ═══
        "───── 2. SCREENSHOT ANIMATION (CRITICAL) ─────",
        "",
        "DO NOT simply zoom screenshots. DO NOT place them flat. DO NOT stretch to fill.",
        "",
        "DEVICE MOCKUP FRAMING:",
        "  borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',",
        "  boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'",
        "  width: '75%' max, centered, NEVER 100%",
        "",
        "MAKE UI FEEL ALIVE — do NOT just show a static screenshot:",
        "  * Isolate UI regions — clip to show one dashboard section at a time",
        "  * Simulate cursor interactions — animate a small circle moving to buttons/inputs",
        "  * Animate metrics — overlay animated counters on top of dashboard areas",
        "  * Card stacking — multiple screenshots at slight offset angles, revealing one by one",
        "  * Spotlight effect — darken screenshot, use radial gradient mask to spotlight one area",
        "  * Layered depth — screenshot behind, glassmorphism cards in front highlighting features",
        "  * Flow between screens — slide one out to left, next enters from right",
        "",
        "ENTRANCE: spring scale 0.85→1.0 + translateY 40→0",
        "CONTINUOUS MOTION (CRITICAL): NEVER leave the screen static after entrance.",
        "  - Drift: translateY = interpolate(frame, [0, 300], [0, -15]) for continuous subtle movement.",
        "  - Float: Math.sin(frame * 0.05) * 8 for floating UI elements.",
        "  - Parallax: Move background items slightly slower than foreground items.",
        "3D TILT: perspective(1200px) rotateY with subtle interpolated angle",
        "",
        "Place text BELOW or BESIDE images, NEVER on top (readability).",
        "",
        imageInstructions,
        logoInstructions,
        "",

        // ═══ 3. ICON RULES ═══
        "───── 3. ICON RULES (CRITICAL) ─────",
        "",
        "ICONS ARE TINY ACCENTS — NEVER the main visual of any scene.",
        "NEVER render icons larger than 24px. NEVER put icons in large circles/containers.",
        "Correct: <Zap size={16} style={{marginRight:8, opacity:0.6}} /> next to text",
        "Correct: 15-20 tiny icons (16px, opacity 0.15) floating in background",
        "WRONG: <Globe size={120} /> as scene center — this is AMATEUR and UGLY",
        "",

        // ═══ 4. TYPOGRAPHY ═══
        "───── 4. TYPOGRAPHY ─────",
        "",
        `Headlines: fontSize: 56-72, fontWeight: 900, letterSpacing: '-0.03em', color: '#FFFFFF', fontFamily: '${fontFamily}'`,
        `  textShadow: '0 0 60px ${primaryColor}50' for premium glow`,
        "Subheads: fontSize: 22-28, fontWeight: 400, color: 'rgba(255,255,255,0.6)'",
        "Labels: fontSize: 14-18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em'",
        "",
        "MAX 5-7 WORDS per text element. Think billboard, not paragraph.",
        "Animate: staggered word reveals, each word delays 3-4 frames, translateY 20→0 + opacity 0→1",
        "Kinetic typography: split text into words, spring each with index-based delay",
        "Masked reveals: clip-path or overflow:hidden with sliding inner div",
        "NEVER put dark text on dark backgrounds. ALWAYS ensure readability.",
        "",

        // ═══ 5. CINEMATIC CAMERA SYSTEM ═══
        "───── 5. CINEMATIC CAMERA SYSTEM ─────",
        "",
        "Use perspective + transform to simulate premium camera movement:",
        "  * Tracking shots: slow interpolated translateX pan across scene",
        "  * Orbital movement: perspective(1200px) rotateY sweeping slowly",
        "  * Depth zoom: scale 1.1→1.0 with slight blur transition",
        "  * Parallax: foreground moves 1.5x speed of background",
        "  * Cinematic reveals: content springs up from below frame edge",
        "  * Perspective tilt between scenes: rotateX transition",
        "",
        "Motion must feel intentional and premium — not random or jittery.",
        "",

        // ═══ 6. MOTION DESIGN ═══
        "───── 6. ADVANCED MOTION DESIGN ─────",
        "",
        "Every frame must have motion. Use 4+ techniques per scene:",
        "  * Spring animations: spring({ frame, fps, config:{ damping:14, stiffness:80 } })",
        "  * Continuous float: Math.sin(frame * 0.02) for organic background movement",
        "  * Staggered reveals: elements enter 4-6 frames apart (index * delay)",
        "  * Parallax depth: 2-3 layers moving at different speeds",
        "  * Gradient orbs: 200-400px blurred circles drifting slowly in background",
        "  * Glassmorphism: background:'rgba(255,255,255,0.05)', backdropFilter:'blur(20px)'",
        "  * Speed ramps: fast entrance → slow float → fast exit",
        "  * Animated gradients: shift hue with interpolateColors over time",
        "  * Spotlight: radial gradient overlay tracking across scene",
        "  * Glow pulses: boxShadow opacity pulsing with Math.sin",
        "  * Animated line art: SVG circle with animated stroke-dashoffset",
        "",
        "TRANSITIONS between Sequences:",
        "  * Scale-down + fade (scene scales to 0.9 and fades out)",
        "  * Directional slide (content slides in from right/bottom)",
        "  * Zoom-through transition",
        "  * NEVER hard-cut between scenes",
        "",

        // ═══ 7. AI CREATIVE DIRECTOR MODE ═══
        "───── 7. AI CREATIVE DIRECTOR MODE ─────",
        "",
        "Auto-select creative direction based on brand type:",
        "  * Fintech / Banking → clean, premium, gold/navy, confident motion",
        "  * AI / ML startup → futuristic, neon glows, particles, energetic",
        "  * Enterprise SaaS → polished, grid layouts, trustworthy, structured",
        "  * Developer tool → dark terminal, monospace accents, smooth reveals",
        "  * Productivity app → elegant, calm, spacious, subtle float",
        "  * Creative tool → experimental, bold color, dynamic, expressive",
        "  * E-commerce → vibrant, product-focused, fast pacing",
        "  * Social media tool → colorful gradients, trend-forward, energetic",
        "",

        // ═══ 8. SCENE STORYTELLING ═══
        "───── 8. SCENE STORYTELLING ─────",
        "",
        "Structure scenes with professional flow (don't just list features):",
        "  1. Cinematic hook — bold statement or dramatic visual reveal",
        "  2. Problem/opportunity — establish why this matters",
        "  3. Product reveal — hero moment with device-framed screenshot",
        "  4. Features showcase — glassmorphism cards with icons + short text",
        "  5. Workflow demo — animated UI walkthrough with simulated cursor",
        "  6. Social proof — animated counters, testimonial cards",
        "  7. Emotional payoff — the transformation/result",
        "  8. Strong CTA — brand logo + action text",
        "",
        "VARY layouts between scenes:",
        "  * Centered hero compositions",
        "  * Split-screen (text left, visual right)",
        "  * Full-bleed screenshot with overlay cards",
        "  * Grid/bento for features",
        "  * Focused metric displays",
        "",

        // ═══ 9. COMPOSITION LAYERS ═══
        "───── 9. SCENE LAYERS ─────",
        "",
        "Every scene has 3 layers:",
        "  Layer 1 (BG):     Animated gradient + 15-20 floating particles (2-4px, opacity 0.1)",
        "  Layer 2 (Content): Screenshots, text, cards — the hero",
        "  Layer 3 (Accents): Tiny floating icons (16px, opacity 0.2), light rays, decorative lines",
        "",
        "PARTICLES (every scene background):",
        "  {Array.from({length: 15}).map((_, i) => {",
        "    const x = random('x-'+i) * 100;",
        "    const y = random('y-'+i) * 100;",
        "    const s = 2 + random('s-'+i) * 3;",
        "    return <div key={i} style={{",
        "      position:'absolute', left:x+'%', top:y+'%', width:s, height:s,",
        "      borderRadius:'50%', background:'rgba(255,255,255,0.1)',",
        "      transform:'translateY('+(Math.sin(frame*0.02+i)*8)+'px)'",
        "    }} />;",
        "  })}",
        "",

        // ═══ 10. ANTI-PATTERNS ═══
        "───── 10. ANTI-PATTERNS — NEVER DO ─────",
        "",
        "✗ Giant Lucide icons as main visuals (amateur, looks like a 2015 tech deck)",
        "✗ Icons in large white/gray circles as hero elements",
        "✗ Plain white backgrounds (cheap, washes out content)",
        "✗ Dark text on dark backgrounds (unreadable)",
        "✗ Screenshots stretched to fill entire screen",
        "✗ Same layout repeated across scenes",
        "✗ Mixing 'background' and 'backgroundColor' on same element",
        "✗ More than 7 words per text element",
        "✗ Static layouts with no motion",
        "✗ PowerPoint-style sequential bullet lists",
        "✗ Simple zoom + fade as the only motion technique",
        "✗ Repetitive animation pacing across scenes",
        "✗ Only zooming screenshots without any creative treatment",
        "✗ Making every scene look identical",
        "",

        // ═══ TECHNICAL ═══
        "════════════════════════════════════════",
        " TECHNICAL RULES",
        "════════════════════════════════════════",
        "",
        "CSS: NEVER mix 'background' and 'backgroundColor' on same element.",
        "Images: Use <Img> (not <img>). Always add borderRadius, shadow, border.",
        "NEVER use loremflickr.com. Use only brand-provided image URLs.",
        "const frame = useCurrentFrame(); const { fps, durationInFrames } = useVideoConfig();",
        "",

        // ═══ THE GOLDEN RULE ═══
        "════════════════════════════════════════",
        " THE GOLDEN RULE",
        "════════════════════════════════════════",
        "",
        "The viewer MUST think: 'This looks expensive.'",
        "If it feels generic, templated, static, or slideshow-like — it has FAILED.",
        "The video must feel handcrafted by a senior motion designer at a top agency.",
        "",

        // ═══ USER REQUEST ═══
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
      ];

      systemPrompt = promptParts.join("\n");
    }

    let text = await generateWithRetry(systemPrompt);

    const cleanCode = text
      .replace(/^```(?:jsx?|tsx?|javascript|typescript|json)?\s*\n?/gim, "")
      .replace(/\n?```\s*$/gim, "")
      .trim();

    console.log("Generated Code Length:", cleanCode.length);

    if (useGodTemplates) {
      try {
        const parsed = JSON.parse(cleanCode);
        parsed.props = {
          ...parsed.props,
          primaryColor: brandKit?.colors?.primary || "#3B82F6",
          secondaryColor: brandKit?.colors?.secondary || "#7C3AED",
          backgroundColor: brandKit?.colors?.background || "#0F172A",
          textColor: brandKit?.colors?.text || "#FFFFFF",
          fontFamily: brandKit?.fonts?.heading || "Inter",
        };
        return NextResponse.json({ videoCode: JSON.stringify(parsed), duration });
      } catch (e) {
        console.error("Failed to parse God Template JSON:", e);
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
