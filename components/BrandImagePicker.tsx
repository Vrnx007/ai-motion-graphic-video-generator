"use client";

import React, { useEffect, useRef } from "react";
import { Image, Trash2, RotateCcw } from "lucide-react";

export type BrandImageItem = { url: string; alt: string; context: string };

function formatFromUrl(url: string): string {
  try {
    const p = new URL(url).pathname.toLowerCase();
    const m = p.match(/\.(avif|webp|jxl|svg|png|jpe?g|gif|bmp|ico)(\?|$)/);
    if (m) return m[1].toUpperCase();
  } catch {
    /* ignore */
  }
  return "IMG";
}

function proxyThumb(url: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

export function BrandImagePicker({
  images,
  onChange,
  extractKey,
}: {
  images: BrandImageItem[];
  onChange: (next: BrandImageItem[]) => void;
  /** e.g. brand kit id — when it changes, "Reset" restores the new extraction */
  extractKey: string;
}) {
  const baselineRef = useRef<BrandImageItem[]>([]);

  useEffect(() => {
    baselineRef.current = [...images];
  }, [extractKey]); // new extraction only — reset snapshot for "Reset"

  const remove = (url: string) => {
    onChange(images.filter((i) => i.url !== url));
  };

  const resetToBaseline = () => {
    onChange([...baselineRef.current]);
  };

  if (images.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-center">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          No images were detected from this page (some sites block scrapers or load assets only in JavaScript). Upload
          assets below or paste image URLs into scenes later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <Image className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-black text-white uppercase tracking-[0.15em]">Images before script</p>
            <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">
              PNG, JPG, WebP, AVIF, GIF, SVG, and similar URLs are collected. Remove anything you do not want in the
              video, then run <span className="text-slate-400">Generate Script</span>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] font-mono text-cyan-400/90">{images.length} selected</span>
          <button
            type="button"
            onClick={resetToBaseline}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/15 bg-white/5 text-[8px] font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/10"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[min(52vh,420px)] overflow-y-auto pr-1 scrollbar-custom">
        {images.map((img) => (
          <div
            key={img.url}
            className="relative group rounded-xl border border-white/10 bg-[#020617]/80 overflow-hidden aspect-[4/3]"
          >
            <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-black/70 text-[8px] font-bold text-white/90 border border-white/10">
                {formatFromUrl(img.url)}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-black/60 text-[7px] font-bold text-slate-400 border border-white/10 max-w-[72px] truncate">
                {img.context}
              </span>
            </div>

            <img
              src={proxyThumb(img.url)}
              alt={img.alt || "asset"}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = img.url;
              }}
            />

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-6">
              <p className="text-[8px] text-slate-300 line-clamp-2 leading-tight">{img.alt || "Untitled asset"}</p>
            </div>

            <button
              type="button"
              title="Remove from list (will not be sent to script AI)"
              onClick={() => remove(img.url)}
              className="absolute top-1.5 right-1.5 p-2 rounded-lg bg-red-600 text-white border border-red-400/80 shadow-lg min-h-[36px] min-w-[36px] flex items-center justify-center active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-[8px] text-slate-600 leading-relaxed">
        URL-only runs depend on how clean the site HTML is; refine the creative directive for best results. Fine edits
        are per scene (copy, duration, template, image URL). Frame-accurate / layer-style compositing is planned, not in
        this build.
      </p>
    </div>
  );
}
