import type { Metadata } from "next"

import { BootstrapDebugPanel } from "@/components/debug/bootstrap-debug-panel"

export const metadata: Metadata = {
  title: "Bootstrap debug — Geoffit",
  description: "Temporary Blood/Hevy bootstrap diagnostics.",
}

export default function BootstrapDebugPage() {
  return <BootstrapDebugPanel />
}
