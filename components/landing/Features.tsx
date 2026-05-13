"use client";

import { motion } from "framer-motion";
import { Globe, Film, Layers, Sparkles, Share2, Wand2 } from "lucide-react";

const features = [
  {
    icon: <Globe className="w-6 h-6" />,
    title: "Brand from your URL",
    description:
      "Scrape headline, palette, logos, hero imagery, and copy signals so the video matches your real marketing site.",
  },
  {
    icon: <Film className="w-6 h-6" />,
    title: "Scene director, not one blob",
    description:
      "Multi-scene storyboard (hook → product → proof → CTA) with per-scene motion direction and template picks.",
  },
  {
    icon: <Layers className="w-6 h-6" />,
    title: "Premium Remotion templates",
    description:
      "Kinetic type, bento grids, browser walkthroughs, 3D hero moments, testimonials, integrations, and comparisons — composed, not random JSX.",
  },
  {
    icon: <Wand2 className="w-6 h-6" />,
    title: "Director + platform presets",
    description:
      "Optional style modes and aspect presets (16:9 launch film, 9:16 shorts) so exports match where you publish.",
  },
  {
    icon: <Share2 className="w-6 h-6" />,
    title: "Share links + WebM export",
    description:
      "Opaque share tokens for previews; in-browser WebM capture today, optional worker MP4 when you wire a render webhook.",
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: "Built for iteration",
    description:
      "Regenerate single scenes, tweak copy in the timeline, and re-stitch without starting from zero.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-[#0f172a] relative overflow-hidden">
      <div className="container px-6 mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-6xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
            Built for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">SaaS launches.</span>
          </h2>
          <p className="text-slate-400 text-xl font-medium">
            Positioning: homepage explainers, feature tours, and launch films — where website-aware branding actually
            matters.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative p-1 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-transparent rounded-[2.5rem] group hover:from-blue-500/50 hover:via-purple-500/50 transition-all duration-500"
            >
              <div className="bg-[#0f172a]/90 backdrop-blur-xl p-10 rounded-[2.4rem] h-full flex flex-col items-center text-center border border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="w-20 h-20 rounded-[1.5rem] bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-8 shadow-[0_0_20px_rgba(59,130,246,0.2)] group-hover:bg-blue-500 group-hover:text-white transition-all duration-500 z-10">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-black text-white mb-4 z-10">{feature.title}</h3>
                <p className="text-slate-400 font-medium leading-relaxed z-10">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
