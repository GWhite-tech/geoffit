/**
 * Local memory probe for the streaming Apple Health archive reader.
 * Run: NODE_PATH=/tmp/ah-mem-probe/node_modules npx tsx scripts/probe-ah-stream-memory.ts
 */
import { readFileSync } from "node:fs"

import { runStreamingAppleHealthPipeline } from "../lib/importers/apple-health/streaming-pipeline"

const ZIP_PATH = process.argv[2] ?? "/Users/geoffw/Downloads/export.zip"

function mb(n: number) {
  return Math.round((n / (1024 * 1024)) * 10) / 10
}

async function main() {
  const bytes = new Uint8Array(readFileSync(ZIP_PATH))
  const file = new File([bytes], "export.zip", { type: "application/zip" })

  let flushed = 0
  let peakRss = process.memoryUsage().rss
  let peakExternal = process.memoryUsage().external

  const sample = setInterval(() => {
    const m = process.memoryUsage()
    peakRss = Math.max(peakRss, m.rss)
    peakExternal = Math.max(peakExternal, m.external)
  }, 500)

  const result = await runStreamingAppleHealthPipeline(file, {
    onBatch: (batch) => {
      flushed += batch.length
    },
  })

  clearInterval(sample)
  const end = process.memoryUsage()

  console.log(
    JSON.stringify(
      {
        scope: "apple-health-stream-probe-summary",
        entryPath: result.entryPath,
        recordsMapped: result.diagnostics.recordsMapped,
        batchesFlushed: result.diagnostics.batchesFlushed,
        flushedViaOnBatch: flushed,
        previewKept: result.domainRecords.length,
        peakRssMB: mb(peakRss),
        peakExternalMB: mb(peakExternal),
        endRssMB: mb(end.rss),
        endExternalMB: mb(end.external),
        endHeapUsedMB: mb(end.heapUsed),
        zipBytes: bytes.byteLength,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
