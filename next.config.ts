import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keep native / complex packages external so Node can require them at runtime.
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
    "tesseract.js",
    "fflate",
    "sax",
  ],
}

export default nextConfig
