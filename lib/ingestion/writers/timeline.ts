import type { TimelineWriteResult, TimelineWriter } from "../types"

/**
 * Projects FACT upserts into timeline_entries.
 * Stub until timeline_entries migration + writers land (see 14-timeline.md).
 */
export const noopTimelineWriter: TimelineWriter = {
  id: "noop-timeline",
  async write(): Promise<TimelineWriteResult> {
    return { written: 0, skipped: 0, errors: [] }
  },
}
