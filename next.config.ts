import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/three",
    "remotion",
    "esbuild",
    "playwright",
    "bullmq",
    "ioredis",
    "sharp",
  ],
};

export default nextConfig;
