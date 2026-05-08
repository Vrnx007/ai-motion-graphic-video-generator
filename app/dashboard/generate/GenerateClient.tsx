"use client";

import { useState } from "react";
import { VideoPreview } from "@/components/VideoPreview";
import BrandPreview from "@/components/BrandPreview";
import SceneTimeline, { Scene } from "@/components/SceneTimeline";
import { stitchScenes, SceneCode } from "@/lib/scene-stitcher";
import {
  Loader2, Wand2, Share2, Check, Download, LayoutDashboard, X,
  Globe, Sparkles, Film, Megaphone, Monitor, Presentation, Play,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const VIDEO_TYPES = [
  { id: "product-launch", label: "Product Launch", icon: Sparkles },
  { id: "feature-explainer", label: "Explainer", icon: Presentation },
  { id: "website-hero", label: "Website Hero", icon: Monitor },
  { id: "ad-creative", label: "Ad Creative", icon: Megaphone },
  { id: "social-teaser", label: "Social Teaser", icon: Film },
  { id: "general", label: "General", icon: Play },
];

type Step = "input" | "brand-review" | "script" | "generating" | "preview";

export default function GenerateClient() {
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
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, videoType, duration, brandKit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScenes(data.scenes || []);
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
    const sceneCodes: SceneCode[] = [];

    for (const scene of scenes) {
      setGeneratingSceneId(scene.id);
      try {
        const res = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `${scene.title}: ${scene.text}. Visual: ${scene.visual}`,
            duration: scene.duration,
            aspectVideo: aspectRatio,
            brandKit,
            scene,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        sceneCodes.push({ id: scene.id, code: data.videoCode, duration: scene.duration });
      } catch (err: any) {
        console.error(`Scene ${scene.id} failed:`, err);
        sceneCodes.push({
          id: scene.id,
          code: `const MyComposition = () => { const frame = useCurrentFrame(); return (<AbsoluteFill style={{background:'#0F172A',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'white',fontSize:40,fontWeight:'bold',opacity:interpolate(frame,[0,15],[0,1],{extrapolateRight:'clamp'})}}>${scene.text}</div></AbsoluteFill>); };`,
          duration: scene.duration,
        });
      }
    }

    setGeneratingSceneId(null);
    const stitched = stitchScenes(sceneCodes);
    setVideoCode(stitched);
    setLoading(false);
    setStep("preview");
  };

  // ── Quick Generate (no scenes, direct) ──
  const handleQuickGenerate = async () => {
    setLoading(true);
    setVideoCode("");
    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, duration, aspectVideo: aspectRatio, brandKit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVideoCode(data.videoCode);
      if (data.duration) setDuration(data.duration);
      setStep("preview");
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
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
        body: JSON.stringify({ videoCode, prompt, duration, aspectRatio }),
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
    try {
      const playerEl = document.querySelector("[data-remotion-player='true']");
      const videoEl = playerEl?.querySelector("video") as HTMLVideoElement | null;
      const canvasEl = playerEl?.querySelector("canvas") as HTMLCanvasElement | null;
      let stream: MediaStream | null = null;
      if (videoEl && (videoEl as any).captureStream) stream = (videoEl as any).captureStream(30);
      else if (canvasEl && (canvasEl as any).captureStream) stream = (canvasEl as any).captureStream(30);
      if (!stream) throw new Error("Could not capture stream. Play the preview first.");

      const mimeType = ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"]
        .find(m => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      const totalMs = duration * 1000;
      const startTime = Date.now();
      const prog = setInterval(() => setDownloadProgress(Math.min(95, Math.round(((Date.now()-startTime)/totalMs)*100))), 200);
      recorder.start(100);

      await new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = e => reject(e);
        setTimeout(() => { recorder.stop(); clearInterval(prog); }, totalMs + 800);
      });

      setDownloadProgress(100);
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      const a = document.createElement("a");
      a.href = url; a.download = `animation-${Date.now()}.webm`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };
  const handleDeleteScene = (id: number) => {
    setScenes(prev => prev.filter(s => s.id !== id));
  };
  const handleRegenerateScene = (id: number) => {
    // For now, just mark it - full regeneration would re-call generate-video for that scene
    alert("Scene regeneration coming soon! Edit the text and regenerate all.");
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
                <input type="range" min="5" max="60" step="5" value={duration} onChange={e => setDuration(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                <div className="flex justify-between text-[7px] text-slate-600 font-bold px-1">
                  <span>5s</span><span>15s</span><span>30s</span><span>60s</span>
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
            </>
          )}

          {/* ── Brand Review (expanded) ── */}
          {step === "brand-review" && brandKit && (
            <BrandPreview brand={brandKit}/>
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
            />
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

                <button onClick={() => { setStep("input"); setVideoCode(""); setScenes([]); }}
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
              code={videoCode}
              duration={scenes.length > 0 ? totalSceneDuration : duration}
              aspectRatio={aspectRatio}
            />
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}