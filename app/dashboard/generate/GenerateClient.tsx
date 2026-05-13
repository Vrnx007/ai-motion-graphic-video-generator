"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { VideoPreview, type VideoPreviewHandle } from "@/components/VideoPreview";
import BrandPreview from "@/components/BrandPreview";
import { BrandImagePicker } from "@/components/BrandImagePicker";
import SceneTimeline, { Scene } from "@/components/SceneTimeline";
import { stitchScenes, SceneCode } from "@/lib/scene-stitcher";
import { resolveBackgroundTrack } from "@/lib/music-tracks";
import { recordRemotionPreviewToWebm, projectDurationSeconds } from "@/lib/record-player-webm";
import {
  Loader2, Wand2, Share2, Check, Download, LayoutDashboard, X,
  Globe, Sparkles, Film, Megaphone, Monitor, Presentation, Play,
  Upload, Image, Palette, Copy, Zap, Crown, Rocket, Minimize2,
  Flame, Laptop, Target, Shuffle, Layout,
} from "lucide-react";
import * as Babel from "@babel/standalone";
import Link from "next/link";
import { motion } from "framer-motion";

const VIDEO_TYPES = [
  { id: "product-launch", label: "Launch", icon: Rocket },
  { id: "feature-explainer", label: "Explainer", icon: Presentation },
  { id: "website-hero", label: "Hero", icon: Monitor },
  { id: "ad-creative", label: "Ad", icon: Megaphone },
  { id: "social-teaser", label: "Social", icon: Film },
  { id: "general", label: "General", icon: Play },
];

const DIRECTOR_STYLES = [
  { id: "premium", label: "Premium", icon: Crown, prompt: "Apple-like premium minimal design, clean typography, lots of whitespace, elegant transitions" },
  { id: "startup", label: "Startup", icon: Rocket, prompt: "Fast-paced startup energy, bold gradients, dynamic text animations, modern SaaS feel" },
  { id: "minimal", label: "Minimal", icon: Minimize2, prompt: "Ultra minimal and clean, subtle animations, thin fonts, monochrome with one accent" },
  { id: "energetic", label: "Energetic", icon: Zap, prompt: "High energy, fast cuts, bold colors, explosive transitions, glitch effects" },
  { id: "cinematic", label: "Cinematic", icon: Film, prompt: "Cinematic film style, letterbox bars, slow Ken Burns, dramatic lighting, vignette" },
  { id: "playful", label: "Playful", icon: Sparkles, prompt: "Fun and playful, bouncy animations, bright colors, rounded shapes, cartoon-like" },
];

const GOD_TEMPLATE_IDS = [
  "KineticHero",
  "BentoGrid",
  "FeatureShowcase",
  "SplitScreen",
  "StatCounter",
  "LogoReveal",
  "ProductOrbit3D",
  "DemoBrowserWalkthrough",
  "LottieOverlay",
] as const;

const PLATFORM_PRESETS = [
  { id: "youtube", label: "YouTube", aspect: "16:9", duration: 30 },
  { id: "tiktok", label: "TikTok", aspect: "9:16", duration: 15 },
  { id: "reels", label: "Reels", aspect: "9:16", duration: 15 },
  { id: "linkedin", label: "LinkedIn", aspect: "16:9", duration: 30 },
  { id: "twitter", label: "X / Twitter", aspect: "16:9", duration: 15 },
  { id: "instagram", label: "IG Post", aspect: "1:1", duration: 15 },
  { id: "shorts", label: "YT Shorts", aspect: "9:16", duration: 30 },
  { id: "website", label: "Website", aspect: "16:9", duration: 60 },
];

type Step = "input" | "brand-review" | "script" | "generating" | "preview";

export default function GenerateClient() {
  const searchParams = useSearchParams();
  // Core state
  const [step, setStep] = useState<Step>("input");
  const [prompt, setPrompt] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [videoType, setVideoType] = useState("general");
  const [duration, setDuration] = useState(30);
  const [aspectRatio, setAspectRatio] = useState("16:9");

  // Brand state
  const [brandKit, setBrandKit] = useState<any>(null);
  const [extractingBrand, setExtractingBrand] = useState(false);

  // Scene state
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<number | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);

  // Video state
  const [videoCode, setVideoCode] = useState("");
  const [sceneCodes, setSceneCodes] = useState<SceneCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingSceneId, setGeneratingSceneId] = useState<number | null>(null);

  // Share/download state
  const [sharing, setSharing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showDownloadSuccess, setShowDownloadSuccess] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // NEW: Director mode, uploads, variations, platform
  const [directorStyle, setDirectorStyle] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<Array<{url: string; alt: string; context: string}>>([]);
  const [uploading, setUploading] = useState(false);
  const [variations, setVariations] = useState<any[]>([]);
  const [generatingVariations, setGeneratingVariations] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<VideoPreviewHandle | null>(null);
  /** From generate-script; used for background track selection (Phase 3) */
  const [musicMood, setMusicMood] = useState<string | null>(null);

  useEffect(() => {
    const rid = searchParams.get("resume");
    if (!rid) return;
    (async () => {
      try {
        const res = await fetch(`/api/get-project?id=${encodeURIComponent(rid)}`);
        const p = await res.json();
        if (!p?.videoCode || p.error) return;
        setVideoCode(p.videoCode);
        setPrompt(p.prompt || "");
        setDuration(Math.max(5, Math.min(300, Number(p.duration) || 10)));
        setAspectRatio(p.aspectRatio || "16:9");
        setVideoType(typeof p.videoType === "string" ? p.videoType : "general");
        if (Array.isArray(p.scenes) && p.scenes.length > 0) setScenes(p.scenes);
        else setScenes([]);
        setMusicMood(typeof p.musicMood === "string" ? p.musicMood : null);
        setSceneCodes([]);
        setStep("preview");
      } catch (e) {
        console.error("[resume project]", e);
      }
    })();
  }, [searchParams]);

  // ── Image Upload Handler ──
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const imageData: Array<{data: string; name: string; type: string}> = [];
      for (const file of Array.from(files).slice(0, 20)) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        imageData.push({ data: base64, name: file.name, type: file.type });
      }
      const res = await fetch("/api/upload-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: imageData, brandKitId: brandKit?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadedImages(prev => [...prev, ...data.images]);
      // Also add to brandKit images if it exists
      if (brandKit) {
        setBrandKit((prev: any) => ({
          ...prev,
          images: [...(prev?.images || []), ...data.images],
        }));
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Generate Variations ──
  const handleGenerateVariations = async (type: string) => {
    setGeneratingVariations(true);
    try {
      const res = await fetch("/api/generate-variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, variationType: type, count: 5, brandKit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVariations(data.variations || []);
    } catch (err: any) {
      alert(`Variations failed: ${err.message}`);
    } finally {
      setGeneratingVariations(false);
    }
  };

  // ── Apply Platform Preset ──
  const applyPlatformPreset = (presetId: string) => {
    const preset = PLATFORM_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setAspectRatio(preset.aspect);
      // Do not change duration — presets used to force "Website" to 10s and overwrote long videos.
      setSelectedPlatform(presetId);
    }
  };

  // ── Get enhanced prompt with director style ──
  const getEnhancedPrompt = () => {
    let enhanced = prompt;
    const style = DIRECTOR_STYLES.find(s => s.id === directorStyle);
    if (style) enhanced += `\n\nSTYLE DIRECTION: ${style.prompt}`;
    return enhanced;
  };

  // ── Step 1: Extract Brand ──
  const handleExtractBrand = async () => {
    if (!websiteUrl) return;
    setExtractingBrand(true);
    try {
      const res = await fetch("/api/extract-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBrandKit(data);
      if (data.headline && !prompt) {
        setPrompt(`Create a ${videoType} video for ${data.headline}`);
      }
      setStep("brand-review");
    } catch (err: any) {
      alert(`Brand extraction failed: ${err.message}`);
    } finally {
      setExtractingBrand(false);
    }
  };

  // ── Step 2: Generate Script ──
  const handleGenerateScript = async () => {
    setGeneratingScript(true);
    const requestedDuration = duration;
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: getEnhancedPrompt(), videoType, duration: requestedDuration, brandKit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const nextScenes = data.scenes || [];
      setScenes(nextScenes);
      setMusicMood(typeof data.musicMood === "string" ? data.musicMood : null);
      setSceneCodes([]);
      const td = Number(data.totalDuration);
      const sceneSum = nextScenes.reduce((s: number, sc: Scene) => s + (Number(sc.duration) || 0), 0);
      if (Number.isFinite(td) && td >= 5 && td <= 300) setDuration(td);
      else if (Number.isFinite(sceneSum) && sceneSum >= 5 && sceneSum <= 300) setDuration(sceneSum);
      else setDuration(requestedDuration);
      setStep("script");
    } catch (err: any) {
      alert(`Script generation failed: ${err.message}`);
    } finally {
      setGeneratingScript(false);
    }
  };

  // ── Step 3: Generate All Scenes ──
  const handleGenerateAllScenes = async () => {
    if (scenes.length === 0) return;
    setLoading(true);
    setStep("generating");
    const collected: SceneCode[] = [];

    const cleanAiCode = (raw: string) => {
      return raw
        .replace(/^```(?:jsx?|tsx?|javascript|typescript|json)?\s*\n?/gim, "")
        .replace(/\n?```\s*$/gim, "")
        .replace(/^(Here is the code:|This is the code:|Certainly!|Sure, here is).*$/gim, "")
        .trim();
    };

    for (const scene of scenes) {
      setGeneratingSceneId(scene.id);
      try {
        const dirStyle = DIRECTOR_STYLES.find(s => s.id === directorStyle);
        const res = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `${scene.title}: ${scene.text}. Visual: ${scene.visual}${dirStyle ? `. STYLE: ${dirStyle.prompt}` : ''}`,
            duration: scene.duration,
            aspectVideo: aspectRatio,
            brandKit,
            scene,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        const safeCode = cleanAiCode(data.videoCode);
        
        let isValid = true;
        if (safeCode.trim().startsWith("{")) {
          try { JSON.parse(safeCode); } catch(e) { isValid = false; }
        } else {
          try { Babel.transform(safeCode, { presets: ["env", "react", "typescript"], filename: "composition.tsx" }); } 
          catch(e) { isValid = false; }
        }
        
        if (!isValid) throw new Error("AI code was truncated or invalid.");
        
        collected.push({ id: scene.id, code: safeCode, duration: scene.duration });
      } catch (err: any) {
        console.error(`Scene ${scene.id} failed:`, err);
        collected.push({
          id: scene.id,
          code: `const MyComposition = () => { return (<AbsoluteFill style={{background:'#FFFFFF',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'#1e293b',fontSize:40,fontWeight:'bold'}}>${scene.text}</div></AbsoluteFill>); };`,
          duration: scene.duration,
        });
      }
    }

    setGeneratingSceneId(null);
    const track = resolveBackgroundTrack(musicMood);
    const stitched = stitchScenes(collected, { musicSrc: track });
    setSceneCodes(collected);
    setVideoCode(stitched);
    setLoading(false);
    setStep("preview");
    
    // Auto-save the project to the library
    autoSaveProject(stitched, scenes.reduce((sum, s) => sum + s.duration, 0), scenes, { musicMood: musicMood ?? undefined });
  };

  // ── Quick Generate (handles long videos by auto-scripting) ──
  const handleQuickGenerate = async () => {
    setLoading(true);
    setVideoCode("");
    try {
      const cleanAiCode = (raw: string) => {
        return raw
          .replace(/^```(?:jsx?|tsx?|javascript|typescript|json)?\s*\n?/gim, "")
          .replace(/\n?```\s*$/gim, "")
          .replace(/^(Here is the code:|This is the code:|Certainly!|Sure, here is).*$/gim, "")
          .trim();
      };

      // If duration is long, we MUST use scene-based generation to avoid AI truncation
      if (duration > 20) {
        console.log("Long duration detected. Using auto-scripting workflow...");
        
        // 1. Generate Script
        const scriptRes = await fetch("/api/generate-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: getEnhancedPrompt(), videoType, duration, brandKit }),
        });
        const scriptData = await scriptRes.json();
        if (!scriptRes.ok) throw new Error(scriptData.error);
        const autoScenes = scriptData.scenes || [];
        setScenes(autoScenes);
        setMusicMood(typeof scriptData.musicMood === "string" ? scriptData.musicMood : null);

        // 2. Generate Each Scene
        const collected: SceneCode[] = [];
        for (const scene of autoScenes) {
          setGeneratingSceneId(scene.id);
          const dirStyle = DIRECTOR_STYLES.find(s => s.id === directorStyle);
          const res = await fetch("/api/generate-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: `${scene.title}: ${scene.text}. Visual: ${scene.visual}${dirStyle ? `. STYLE: ${dirStyle.prompt}` : ''}`,
              duration: scene.duration,
              aspectVideo: aspectRatio,
              brandKit,
              scene,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          
          const safeCode = cleanAiCode(data.videoCode);
          let isValid = true;
          if (safeCode.trim().startsWith("{")) {
            try { JSON.parse(safeCode); } catch(e) { isValid = false; }
          } else {
            try { Babel.transform(safeCode, { presets: ["env", "react", "typescript"], filename: "composition.tsx" }); } 
            catch(e) { isValid = false; }
          }
          if (!isValid) {
            console.warn(`Quick generate scene ${scene.id} truncated, using fallback`);
            collected.push({
              id: scene.id,
              code: `const MyComposition = () => { return (<AbsoluteFill style={{background:'#FFFFFF',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'#1e293b',fontSize:40,fontWeight:'bold'}}>${scene.text}</div></AbsoluteFill>); };`,
              duration: scene.duration,
            });
          } else {
            collected.push({ id: scene.id, code: safeCode, duration: scene.duration });
          }
        }
        
        setGeneratingSceneId(null);
        const track = resolveBackgroundTrack(
          typeof scriptData.musicMood === "string" ? scriptData.musicMood : musicMood
        );
        const stitched = stitchScenes(collected, { musicSrc: track });
        setSceneCodes(collected);
        setVideoCode(stitched);
        setStep("preview");
        autoSaveProject(stitched, duration, autoScenes, { musicMood: typeof scriptData.musicMood === "string" ? scriptData.musicMood : undefined });
      } else {
        // Short video: single generation is fine
        const res = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: getEnhancedPrompt(), duration, aspectVideo: aspectRatio, brandKit }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        const safeCode = cleanAiCode(data.videoCode);
        
        let isValid = true;
        if (safeCode.trim().startsWith("{")) {
          try { JSON.parse(safeCode); } catch(e) { isValid = false; }
        } else {
          try { Babel.transform(safeCode, { presets: ["env", "react", "typescript"], filename: "composition.tsx" }); } 
          catch(e) { isValid = false; }
        }
        
        if (!isValid) throw new Error("The AI generated incomplete code due to length limits. Please try again or use a longer duration to enable scene-based generation.");
        
        setVideoCode(safeCode);
        if (data.duration) setDuration(data.duration);
        setSceneCodes([]);
        setStep("preview");
        autoSaveProject(safeCode, data.duration || duration, undefined, { musicMood: musicMood ?? undefined });
      }
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
      setGeneratingSceneId(null);
    }
  };

  // ── Auto Save ──
  const autoSaveProject = async (codeToSave: string, currentDuration: number, scenePayload?: Scene[], extra?: { musicMood?: string }) => {
    try {
      const res = await fetch("/api/save-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoCode: codeToSave,
          prompt: getEnhancedPrompt(),
          duration: currentDuration,
          aspectRatio,
          videoType,
          scenes: scenePayload ?? (scenes.length > 0 ? scenes : undefined),
          musicMood: extra?.musicMood ?? musicMood ?? undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setShareUrl(`${window.location.origin}/share/${data.id}`);
      }
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  };

  // ── Share ──
  const handleShare = async () => {
    if (!videoCode) return;
    setSharing(true);
    try {
      const res = await fetch("/api/save-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoCode,
          prompt,
          duration: scenes.length > 0 ? totalSceneDuration : duration,
          aspectRatio,
          videoType,
          scenes: scenes.length > 0 ? scenes : undefined,
          musicMood: musicMood ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const url = `${window.location.origin}/share/${data.id}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSharing(false);
    }
  };

  // ── Download (client-side recording) ──
  const handleDownload = async () => {
    if (!videoCode) return;
    setRendering(true);
    setDownloadProgress(0);
    const exportDurationSec = projectDurationSeconds({
      duration,
      scenes: scenes.length > 0 ? scenes : undefined,
    });
    try {
      videoPreviewRef.current?.seekToStart();
      videoPreviewRef.current?.play();
      const blob = await recordRemotionPreviewToWebm({
        durationSec: exportDurationSec,
        onProgress: setDownloadProgress,
        warmupMs: 600,
      });
      setDownloadProgress(100);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `animation-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setShowDownloadSuccess(true);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setRendering(false);
      setTimeout(() => setDownloadProgress(0), 2000);
    }
  };

  // ── Scene handlers ──
  const handleUpdateScene = (id: number, updates: Partial<Scene>) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    if (typeof updates.duration === "number") {
      const nc = sceneCodes.map((c) =>
        c.id === id ? { ...c, duration: updates.duration! } : c
      );
      setSceneCodes(nc);
      if (step === "preview" && nc.length) {
        setVideoCode(stitchScenes(nc, { musicSrc: resolveBackgroundTrack(musicMood) }));
      }
    }
  };
  const handleDeleteScene = (id: number) => {
    const ns = scenes.filter((s) => s.id !== id);
    const nc = sceneCodes.filter((c) => c.id !== id);
    setScenes(ns);
    setSceneCodes(nc);
    if (step === "preview") {
      if (nc.length) {
        setVideoCode(stitchScenes(nc, { musicSrc: resolveBackgroundTrack(musicMood) }));
      } else {
        setVideoCode("");
      }
    }
  };

  const moveScene = (id: number, dir: -1 | 1) => {
    const i = scenes.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= scenes.length) return;
    const ns = [...scenes];
    [ns[i], ns[j]] = [ns[j], ns[i]];
    const ci = sceneCodes.findIndex((c) => c.id === id);
    const cj = ci + dir;
    if (ci < 0 || cj < 0 || cj >= sceneCodes.length) {
      setScenes(ns);
      return;
    }
    const nc = [...sceneCodes];
    [nc[ci], nc[cj]] = [nc[cj], nc[ci]];
    setScenes(ns);
    setSceneCodes(nc);
    if (step === "preview" && nc.length) {
      setVideoCode(stitchScenes(nc, { musicSrc: resolveBackgroundTrack(musicMood) }));
    }
  };
  const handleRegenerateScene = async (id: number) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene) return;
    if (!sceneCodes.some((c) => c.id === id)) {
      alert("Generate the full video first, then you can regenerate individual scenes.");
      return;
    }
    setGeneratingSceneId(id);
    const cleanAiCode = (raw: string) =>
      raw
        .replace(/^```(?:jsx?|tsx?|javascript|typescript|json)?\s*\n?/gim, "")
        .replace(/\n?```\s*$/gim, "")
        .replace(/^(Here is the code:|This is the code:|Certainly!|Sure, here is).*$/gim, "")
        .trim();
    try {
      const dirStyle = DIRECTOR_STYLES.find((s) => s.id === directorStyle);
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${scene.title}: ${scene.text}. Visual: ${scene.visual}${dirStyle ? `. STYLE: ${dirStyle.prompt}` : ""}`,
          duration: scene.duration,
          aspectVideo: aspectRatio,
          brandKit,
          scene,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const safeCode = cleanAiCode(data.videoCode);
      let isValid = true;
      if (safeCode.trim().startsWith("{")) {
        try {
          JSON.parse(safeCode);
        } catch {
          isValid = false;
        }
      } else {
        try {
          Babel.transform(safeCode, { presets: ["env", "react", "typescript"], filename: "composition.tsx" });
        } catch {
          isValid = false;
        }
      }
      if (!isValid) throw new Error("Invalid AI output");
      const nc = sceneCodes.map((c) =>
        c.id === id ? { ...c, code: safeCode, duration: scene.duration } : c
      );
      setSceneCodes(nc);
      const stitched = stitchScenes(nc, { musicSrc: resolveBackgroundTrack(musicMood) });
      if (step === "preview" && nc.length) {
        setVideoCode(stitched);
        autoSaveProject(stitched, scenes.reduce((sum, s) => sum + s.duration, 0), scenes, {
          musicMood: musicMood ?? undefined,
        });
      }
    } catch (e: any) {
      alert(`Regenerate failed: ${e?.message || "Unknown error"}`);
    } finally {
      setGeneratingSceneId(null);
    }
  };

  const totalSceneDuration = scenes.reduce((s, sc) => s + sc.duration, 0);

  return (
    <div className="flex flex-col lg:flex-row flex-1 h-screen overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] relative">

      {/* Download Success Popup */}
      {showDownloadSuccess && (
        <motion.div initial={{opacity:0,y:50,scale:0.9}} animate={{opacity:1,y:0,scale:1}}
          className="fixed bottom-10 right-10 z-[100] p-6 bg-[#020617]/90 backdrop-blur-2xl border border-emerald-500/30 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400"><Check size={24}/></div>
          <div>
            <h3 className="text-white font-black uppercase text-xs tracking-widest mb-1">Ready</h3>
            <p className="text-slate-400 text-[10px]">Video downloaded successfully.</p>
          </div>
          <button onClick={() => { setDownloadUrl(null); setShowDownloadSuccess(false); }} className="ml-4 p-2 text-slate-500 hover:text-white"><X size={16}/></button>
        </motion.div>
      )}

      {/* Background Orbs */}
      <motion.div animate={{scale:[1,1.2,1],opacity:[0.2,0.4,0.2]}} transition={{duration:10,repeat:Infinity}}
        className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] bg-blue-600/20 blur-[150px] rounded-full pointer-events-none"/>

      {/* SIDEBAR */}
      <motion.aside initial={{x:-100,opacity:0}} animate={{x:0,opacity:1}} transition={{duration:0.6}}
        className="w-full lg:w-[420px] h-[50vh] lg:h-full shrink-0 bg-[#0f172a]/60 backdrop-blur-3xl border-b lg:border-b-0 lg:border-r border-white/10 p-6 lg:p-8 flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.5)] lg:shadow-[20px_0_50px_rgba(0,0,0,0.5)] relative z-20 overflow-y-auto overflow-x-hidden scrollbar-custom order-2 lg:order-1">

        <Link href="/dashboard" className="mb-6 text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2 hover:text-white transition-colors shrink-0">
          <LayoutDashboard size={14}/> Dashboard
        </Link>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {["input","brand-review","script","preview"].map((s,i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${
              ["input","brand-review","script","generating","preview"].indexOf(step) >= i ? "bg-blue-500" : "bg-white/10"
            }`}/>
          ))}
        </div>

        <div className="space-y-6 flex-1">

          {/* ── STEP: INPUT ── */}
          {(step === "input" || step === "brand-review" || step === "script") && (
            <>
              {/* Website URL */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Website URL</label>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl opacity-20 group-hover:opacity-40 transition blur"/>
                  <div className="relative flex gap-2">
                    <input
                      className="flex-1 p-3 rounded-xl border border-white/10 bg-[#020617]/80 text-white text-sm focus:border-emerald-500 outline-none"
                      placeholder="https://your-website.com"
                      value={websiteUrl}
                      onChange={e => setWebsiteUrl(e.target.value)}
                    />
                    <button
                      onClick={handleExtractBrand}
                      disabled={!websiteUrl || extractingBrand}
                      className="px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50 text-xs font-bold"
                    >
                      {extractingBrand ? <Loader2 className="w-4 h-4 animate-spin"/> : <Globe size={16}/>}
                    </button>
                  </div>
                </div>
                {extractingBrand && <p className="text-[9px] text-emerald-400/70 animate-pulse ml-1">Extracting brand identity...</p>}
                {brandKit && step === "brand-review" && (
                  <p className="text-[9px] text-slate-500 leading-relaxed ml-1 border-l-2 border-emerald-500/40 pl-2">
                    URL-only runs use public HTML (no login). Quality depends on the site; refine your creative directive
                    and curate images below before script for the cleanest result.
                  </p>
                )}
              </div>

              {/* Brand Preview (compact) */}
              {brandKit && <BrandPreview brand={brandKit} compact={step !== "brand-review"}/>}

              {/* Prompt */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Creative Directive</label>
                <textarea
                  className="w-full h-28 p-4 rounded-xl border border-white/10 bg-[#020617]/80 text-white text-sm focus:border-blue-500 outline-none resize-none"
                  placeholder={brandKit ? `Describe the video for ${brandKit.headline || "your brand"}...` : "Describe your video..."}
                  value={prompt} onChange={e => setPrompt(e.target.value)}
                />
              </div>

              {/* Video Type */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Video Type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {VIDEO_TYPES.map(vt => {
                    const Icon = vt.icon;
                    return (
                      <button key={vt.id} onClick={() => setVideoType(vt.id)}
                        className={`py-2 px-1 rounded-lg text-[8px] font-black uppercase tracking-wider border transition-all flex flex-col items-center gap-1 ${
                          videoType === vt.id ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "bg-white/5 border-white/10 text-slate-500 hover:bg-white/10"
                        }`}>
                        <Icon size={14}/>{vt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Duration</label>
                  <span className="text-[9px] font-black text-blue-400">{duration}s</span>
                </div>
                <input type="range" min="5" max="300" step="5" value={duration} onChange={e => setDuration(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                <div className="flex justify-between text-[7px] text-slate-600 font-bold px-1">
                  <span>5s</span><span>30s</span><span>60s</span><span>5m</span>
                </div>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{id:"16:9",label:"Cinema",icon:"📺"},{id:"9:16",label:"Shorts",icon:"📱"},{id:"1:1",label:"Social",icon:"⬛"}].map(r => (
                    <button key={r.id} onClick={() => setAspectRatio(r.id)}
                      className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                        aspectRatio === r.id ? "bg-blue-500 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      }`}>
                      <span className="text-sm">{r.icon}</span> {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Director Mode */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1"><Crown className="w-3 h-3"/> Director Mode</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {DIRECTOR_STYLES.map(ds => {
                    const Icon = ds.icon;
                    return (
                      <button key={ds.id} onClick={() => setDirectorStyle(directorStyle === ds.id ? null : ds.id)}
                        className={`py-2 px-1 rounded-lg text-[8px] font-black uppercase tracking-wider border transition-all flex flex-col items-center gap-1 ${
                          directorStyle === ds.id ? "bg-purple-500/20 border-purple-500/40 text-purple-400" : "bg-white/5 border-white/10 text-slate-500 hover:bg-white/10"
                        }`}>
                        <Icon size={12}/>{ds.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Platform Presets */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1"><Layout className="w-3 h-3"/> Platform</label>
                <div className="flex gap-1.5 flex-wrap">
                  {PLATFORM_PRESETS.map(p => (
                    <button key={p.id} onClick={() => applyPlatformPreset(p.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[8px] font-bold border transition-all ${
                        selectedPlatform === p.id ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" : "bg-white/5 border-white/10 text-slate-500 hover:bg-white/10"
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1"><Image className="w-3 h-3"/> Assets</label>
                <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden"/>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="w-full py-3 rounded-xl border border-dashed border-white/20 bg-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload size={14}/>}
                  {uploading ? "Uploading..." : "Upload Screenshots / Images"}
                </button>
                {uploadedImages.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {uploadedImages.map((img, i) => (
                      <div key={i} className="relative group">
                        <img src={img.url} alt={img.alt} className="w-10 h-10 rounded-lg object-cover border border-white/10"/>
                        <button onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-2.5 h-2.5 text-white"/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Variations (visible when prompt exists) */}
              {prompt && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1"><Shuffle className="w-3 h-3"/> Variations</label>
                  <div className="flex gap-1.5">
                    {["hooks","styles","ctas","angles"].map(t => (
                      <button key={t} onClick={() => handleGenerateVariations(t)} disabled={generatingVariations}
                        className="flex-1 py-1.5 rounded-lg text-[7px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-slate-500 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50">
                        {t}
                      </button>
                    ))}
                  </div>
                  {generatingVariations && <p className="text-[9px] text-purple-400/70 animate-pulse ml-1">Generating variations...</p>}
                  {variations.length > 0 && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-custom">
                      {variations.map((v: any) => (
                        <button key={v.id} onClick={() => setPrompt(prompt + "\n" + v.promptModifier)}
                          className="w-full text-left p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                          <p className="text-[9px] font-bold text-white">{v.name}</p>
                          <p className="text-[8px] text-slate-500 line-clamp-1">{v.description}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Brand Review (expanded) ── */}
          {step === "brand-review" && brandKit && (
            <div className="space-y-4">
              <BrandPreview brand={brandKit} showImageGallery={false} />
              <BrandImagePicker
                extractKey={String(brandKit.id ?? brandKit.sourceUrl ?? "brand")}
                images={Array.isArray(brandKit.images) ? brandKit.images : []}
                onChange={(next) => setBrandKit((prev: any) => (prev ? { ...prev, images: next } : prev))}
              />
            </div>
          )}

          {/* ── Scene Timeline ── */}
          {(step === "script" || step === "generating" || step === "preview") && scenes.length > 0 && (
            <SceneTimeline
              scenes={scenes}
              activeSceneId={activeSceneId}
              onSelectScene={setActiveSceneId}
              onUpdateScene={handleUpdateScene}
              onDeleteScene={handleDeleteScene}
              onRegenerateScene={handleRegenerateScene}
              onReorderScenes={setScenes}
              generatingSceneId={generatingSceneId}
              hideSegmentBar={step === "preview"}
              onMoveScene={moveScene}
            />
          )}

          {activeSceneId !== null &&
            scenes.some((s) => s.id === activeSceneId) &&
            (step === "script" || step === "preview") && (
              <div className="rounded-xl border border-white/10 bg-[#020617]/80 p-3 space-y-2">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Scene editor</p>
                {(() => {
                  const sc = scenes.find((s) => s.id === activeSceneId)!;
                  return (
                    <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-custom">
                      <label className="block text-[8px] text-slate-500 font-bold uppercase">Title</label>
                      <input
                        className="w-full text-xs p-2 rounded-lg bg-white/5 border border-white/10 text-white"
                        value={sc.title}
                        onChange={(e) => handleUpdateScene(sc.id, { title: e.target.value })}
                      />
                      <label className="block text-[8px] text-slate-500 font-bold uppercase">On-screen text</label>
                      <input
                        className="w-full text-xs p-2 rounded-lg bg-white/5 border border-white/10 text-white"
                        value={sc.text}
                        onChange={(e) => handleUpdateScene(sc.id, { text: e.target.value })}
                      />
                      <label className="block text-[8px] text-slate-500 font-bold uppercase">Visual direction</label>
                      <textarea
                        className="w-full text-[11px] p-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 resize-none h-16"
                        value={sc.visual}
                        onChange={(e) => handleUpdateScene(sc.id, { visual: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] text-slate-500 font-bold uppercase">Duration (s)</label>
                          <input
                            type="number"
                            min={3}
                            max={120}
                            className="w-full text-xs p-2 rounded-lg bg-white/5 border border-white/10 text-white"
                            value={sc.duration}
                            onChange={(e) =>
                              handleUpdateScene(sc.id, { duration: Math.max(3, Math.min(120, parseInt(e.target.value, 10) || 3)) })
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] text-slate-500 font-bold uppercase">Template</label>
                          <select
                            className="w-full text-[10px] p-2 rounded-lg bg-white/5 border border-white/10 text-white"
                            value={sc.templateName || ""}
                            onChange={(e) =>
                              handleUpdateScene(sc.id, { templateName: e.target.value || undefined })
                            }
                          >
                            <option value="">Auto</option>
                            {GOD_TEMPLATE_IDS.map((tid) => (
                              <option key={tid} value={tid}>
                                {tid}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <label className="block text-[8px] text-slate-500 font-bold uppercase">Image URL</label>
                      <input
                        className="w-full text-[10px] p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300"
                        value={sc.imageUrl || ""}
                        placeholder="https://..."
                        onChange={(e) => handleUpdateScene(sc.id, { imageUrl: e.target.value || undefined })}
                      />
                    </div>
                  );
                })()}
              </div>
            )}

          {/* ── Action Buttons ── */}
          <div className="grid gap-3 mt-auto pt-4">
            {/* Script generation button */}
            {(step === "input" || step === "brand-review") && (
              <>
                <motion.button whileHover={{scale:prompt?1.02:1}} whileTap={{scale:prompt?0.98:1}}
                  onClick={handleGenerateScript}
                  disabled={!prompt || generatingScript || loading}
                  className="w-full relative overflow-hidden group bg-[#020617] border border-purple-500/30 text-white py-4 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 disabled:opacity-50">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity"/>
                  <div className="relative z-10 flex items-center gap-2">
                    {generatingScript ? <Loader2 className="animate-spin w-4 h-4"/> : <Wand2 size={16}/>}
                    {generatingScript ? "Creating Script..." : "Generate Script"}
                  </div>
                </motion.button>

                <motion.button whileHover={{scale:prompt?1.02:1}} whileTap={{scale:prompt?0.98:1}}
                  onClick={handleQuickGenerate}
                  disabled={!prompt || loading || generatingScript}
                  className="w-full bg-white/5 border border-white/10 text-slate-400 py-3 rounded-xl font-bold uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-white/10 disabled:opacity-50 transition-all">
                  {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Sparkles size={14}/>}
                  {loading ? "Generating..." : "Quick Generate (No Script)"}
                </motion.button>
              </>
            )}

            {/* Generate scenes button */}
            {step === "script" && scenes.length > 0 && (
              <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}}
                onClick={handleGenerateAllScenes}
                disabled={loading}
                className="w-full relative overflow-hidden group bg-[#020617] border border-blue-500/30 text-white py-4 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 disabled:opacity-50">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-80 group-hover:opacity-100 transition-opacity"/>
                <div className="relative z-10 flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <Film size={16}/>}
                  Generate {scenes.length} Scenes ({totalSceneDuration}s)
                </div>
              </motion.button>
            )}

            {/* Generating progress */}
            {step === "generating" && (
              <div className="text-center py-4">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2"/>
                <p className="text-[10px] text-blue-400 font-bold">
                  Generating scene {generatingSceneId || "..."}
                </p>
              </div>
            )}

            {/* Preview actions */}
            {step === "preview" && videoCode && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                    onClick={handleShare} disabled={sharing}
                    className={`py-3 rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-2 border transition-all ${
                      shareUrl ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                    }`}>
                    {sharing ? <Loader2 className="animate-spin w-4 h-4"/> : copied ? <Check size={14}/> : <Share2 size={14}/>}
                    {copied ? "Copied" : "Share"}
                  </motion.button>
                  <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                    onClick={handleDownload} disabled={rendering}
                    className="py-3 rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-2 border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all disabled:opacity-50">
                    {rendering ? <Loader2 className="animate-spin w-4 h-4"/> : <Download size={14}/>}
                    {rendering ? "Recording..." : "Download"}
                  </motion.button>
                </div>

                {rendering && downloadProgress > 0 && (
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all" style={{width:`${downloadProgress}%`}}/>
                  </div>
                )}

                {shareUrl && (
                  <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/30 break-all">
                    <code className="text-[10px] text-blue-300 font-mono">{shareUrl}</code>
                  </div>
                )}

                <button onClick={() => { setStep("input"); setVideoCode(""); setScenes([]); setSceneCodes([]); setMusicMood(null); }}
                  className="text-[9px] text-slate-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-center py-2">
                  ← Start Over
                </button>
              </>
            )}
          </div>
          <div className="h-4 shrink-0"/>
        </div>
      </motion.aside>

      {/* PREVIEW */}
      <section className="flex-1 flex flex-col items-center justify-center p-4 lg:p-16 relative z-10 overflow-hidden min-h-[50vh] lg:min-h-0 order-1 lg:order-2">
        <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} transition={{duration:0.7,delay:0.2,type:"spring"}}
          className="relative group w-full max-w-5xl perspective-1000">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-[3rem] blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"/>
          <motion.div whileHover={{scale:1.01}}
            className="relative aspect-video bg-[#020617] rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden border border-white/10">
            <VideoPreview
              ref={videoPreviewRef}
              code={videoCode}
              duration={scenes.length > 0 ? totalSceneDuration : duration}
              aspectRatio={aspectRatio}
              variant={step === "preview" ? "clean" : "editor"}
              musicSrc={resolveBackgroundTrack(musicMood)}
            />
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}