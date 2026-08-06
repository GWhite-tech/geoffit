import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keep native / complex packages external so Node loads them at runtime (ESM).
  // NFT already traces real .pnpm paths for pdfjs-dist; do not add
  // outputFileTracingIncludes for node_modules/pdfjs-dist (pnpm symlink → Vercel reject).
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
    "fflate",
    "sax",
  ],
}

export default nextConfig
