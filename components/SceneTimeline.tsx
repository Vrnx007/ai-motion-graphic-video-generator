"use client";

import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Zap, AlertCircle, Lightbulb, Layers, Star, ArrowRight,
  RefreshCw, Trash, Play, Clock, ChevronLeft, ChevronRight,
} from "lucide-react";

export interface Scene {
  id: number;
  type: string;
  duration: number;
  title: string;
  text: string;
  visual: string;
  imageUrl?: string;
  templateName?: string;
}

interface SceneTimelineProps {
  scenes: Scene[];
  activeSceneId?: number | null;
  onSelectScene: (id: number) => void;
  onUpdateScene: (id: number, updates: Partial<Scene>) => void;
  onDeleteScene: (id: number) => void;
  onRegenerateScene: (id: number) => void;
  onReorderScenes: (scenes: Scene[]) => void;
  generatingSceneId?: number | null;
  hideSegmentBar?: boolean;
  onMoveScene?: (id: number, direction: -1 | 1) => void;
}

const SCENE_TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string }> = {
  hook: { icon: Zap, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  problem: { icon: AlertCircle, color: "text-red-400 bg-red-500/10 border-red-500/20" },
  solution: { icon: Lightbulb, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  demo: { icon: Play, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  features: { icon: Layers, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  "social-proof": { icon: Star, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  cta: { icon: ArrowRight, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  intro: { icon: Play, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  outro: { icon: ArrowRight, color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
};

export default function SceneTimeline({
  scenes,
  activeSceneId,
  onSelectScene,
  onUpdateScene,
  onDeleteScene,
  onRegenerateScene,
  generatingSceneId,
  hideSegmentBar = false,
  onMoveScene,
}: SceneTimelineProps) {
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
            Scene Timeline
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
          <Clock className="w-3 h-3" />
          <span className="font-bold">{totalDuration}s</span>
          <span>• {scenes.length} scenes</span>
        </div>
      </div>

      {/* Timeline bar — optional; hidden on preview for a cleaner canvas */}
      {!hideSegmentBar && (
      <div className="flex h-2 rounded-full overflow-hidden bg-white/5 border border-white/10">
        {scenes.map((scene, i) => {
          const width = (scene.duration / totalDuration) * 100;
          const config = SCENE_TYPE_CONFIG[scene.type] || SCENE_TYPE_CONFIG.hook;
          const isActive = scene.id === activeSceneId;
          return (
            <div
              key={scene.id}
              className={`h-full cursor-pointer transition-all hover:brightness-125 ${isActive ? "ring-1 ring-white" : ""}`}
              style={{
                width: `${width}%`,
                background: `hsl(${(i * 60) % 360}, 60%, 50%)`,
              }}
              onClick={() => onSelectScene(scene.id)}
              title={`${scene.title} (${scene.duration}s)`}
            />
          );
        })}
      </div>
      )}

      {/* Scene cards */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-custom">
        {scenes.map((scene) => {
          const config = SCENE_TYPE_CONFIG[scene.type] || SCENE_TYPE_CONFIG.hook;
          const Icon = config.icon;
          const isActive = scene.id === activeSceneId;
          const isGenerating = scene.id === generatingSceneId;

          return (
            <motion.div
              key={scene.id}
              layout
              onClick={() => onSelectScene(scene.id)}
              className={`relative flex-shrink-0 w-48 p-3 rounded-xl border cursor-pointer transition-all group ${
                isActive
                  ? "bg-white/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                  : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20"
              }`}
            >
              {isGenerating && (
                <div className="absolute inset-0 bg-blue-500/5 rounded-xl flex items-center justify-center backdrop-blur-sm z-10">
                  <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                </div>
              )}

              {/* Scene type badge */}
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-wider ${config.color}`}>
                  <Icon className="w-2.5 h-2.5" />
                  {scene.type}
                </span>
                <span className="text-[9px] text-slate-500 font-bold">{scene.duration}s</span>
              </div>

              {/* Scene content */}
              <p className="text-[10px] font-bold text-white line-clamp-2 mb-1">{scene.title}</p>
              <p className="text-[9px] text-slate-400 line-clamp-2">{scene.text}</p>

              {/* Image thumbnail */}
              {scene.imageUrl && (
                <img
                  src={scene.imageUrl}
                  alt=""
                  className="w-full h-10 object-cover rounded-md mt-2 border border-white/10"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}

              {/* Actions (visible on hover) */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onMoveScene && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onMoveScene(scene.id, -1); }}
                      className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-400"
                      title="Move earlier"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onMoveScene(scene.id, 1); }}
                      className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-400"
                      title="Move later"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onRegenerateScene(scene.id); }}
                  className="p-1 rounded-md bg-white/10 hover:bg-blue-500/30 text-slate-400 hover:text-blue-400 transition-colors"
                  title="Regenerate"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                {scenes.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteScene(scene.id); }}
                    className="p-1 rounded-md bg-white/10 hover:bg-red-500/30 text-slate-400 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
