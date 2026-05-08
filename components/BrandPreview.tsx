"use client";

import React from "react";
import { Globe, Palette, Type, Image, Sparkles, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface BrandPreviewProps {
  brand: {
    name?: string;
    sourceUrl?: string;
    logoUrl?: string | null;
    colors?: { primary: string; secondary?: string | null; accent?: string | null; background?: string; text?: string };
    brandPalette?: string[];
    fonts?: { heading: string; body: string };
    headline?: string | null;
    subheadline?: string | null;
    features?: Array<{ title: string; description: string }>;
    cta?: string | null;
    tone?: string | null;
    style?: string | null;
    images?: Array<{ url: string; alt: string; context: string }>;
  };
  compact?: boolean;
}

export default function BrandPreview({ brand, compact = false }: BrandPreviewProps) {
  const palette = brand.brandPalette || [];
  const images = brand.images || [];
  const features = brand.features || [];

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
        {brand.logoUrl && (
          <img src={brand.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white/10" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{brand.headline || brand.name}</p>
          <div className="flex gap-1 mt-1">
            {palette.slice(0, 5).map((c, i) => (
              <div key={i} className="w-3 h-3 rounded-full border border-white/20" style={{ background: c }} />
            ))}
          </div>
        </div>
        <span className="text-[8px] text-emerald-400 font-black uppercase tracking-widest">Active</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 p-5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        {brand.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt="Logo"
            className="w-14 h-14 rounded-xl object-contain bg-white/10 p-1 border border-white/10"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Globe className="w-6 h-6 text-slate-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-white truncate">{brand.headline || brand.name || "Brand"}</h3>
          {brand.subheadline && (
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{brand.subheadline}</p>
          )}
          {brand.sourceUrl && (
            <a
              href={brand.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[9px] text-blue-400 hover:text-blue-300 mt-1"
            >
              <ExternalLink className="w-3 h-3" />
              {new URL(brand.sourceUrl).hostname}
            </a>
          )}
        </div>
      </div>

      {/* Color Palette */}
      {palette.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Palette className="w-3 h-3 text-slate-500" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Colors</span>
          </div>
          <div className="flex gap-2">
            {palette.map((color, i) => (
              <div key={i} className="group relative">
                <div
                  className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer hover:scale-110 transition-transform shadow-lg"
                  style={{ background: color }}
                />
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-slate-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {color}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Style & Tone */}
      <div className="flex gap-2 flex-wrap">
        {brand.tone && (
          <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[9px] font-bold text-blue-400 uppercase tracking-wider">
            {brand.tone}
          </span>
        )}
        {brand.style && (
          <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[9px] font-bold text-purple-400 uppercase tracking-wider">
            {brand.style}
          </span>
        )}
        {brand.fonts?.heading && (
          <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Type className="w-3 h-3" />
            {brand.fonts.heading}
          </span>
        )}
        {brand.cta && (
          <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
            CTA: {brand.cta}
          </span>
        )}
      </div>

      {/* Features */}
      {features.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3 h-3 text-slate-500" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Features</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {features.slice(0, 4).map((f, i) => (
              <div key={i} className="px-2 py-1.5 bg-white/5 rounded-lg">
                <p className="text-[10px] font-bold text-white truncate">{f.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Images */}
      {images.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Image className="w-3 h-3 text-slate-500" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
              {images.length} Images Found
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {images.slice(0, 6).map((img, i) => (
              <img
                key={i}
                src={img.url}
                alt={img.alt}
                className="w-16 h-12 rounded-lg object-cover border border-white/10 flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
