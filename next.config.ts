import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "tesseract.js", "fflate", "sax"],
}

export default nextConfig
