import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keep native / complex packages external so Node loads them at runtime (ESM).
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
    "fflate",
    "sax",
  ],
  // Ship pdf.js asset dirs into serverless bundles (static cwd paths in pdfjs-asset-urls).
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/pdfjs-dist/legacy/**/*",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/pdfjs-dist/cmaps/**/*",
      "./node_modules/pdfjs-dist/wasm/**/*",
    ],
  },
}

export default nextConfig
