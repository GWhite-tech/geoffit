/**
 * Observation-only memory snapshots for the Apple Health streaming pipeline.
 */
export function logAppleHealthMemory(
  stage: string,
  checkpoint: "before" | "after",
  extra: Record<string, unknown> = {}
): void {
  const mem = process.memoryUsage()
  console.info(
    JSON.stringify({
      scope: "apple-health-stream-memory",
      stage,
      checkpoint,
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      ...extra,
    })
  )
}
