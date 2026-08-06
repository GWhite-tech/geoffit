import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keep native / complex packages external so Node can require them at runtime.
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
    "fflate",
    "sax",
  ],
  // Ensure cmaps / fonts / wasm ship with serverless functions (not only pdf.mjs).
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
