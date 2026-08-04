"use client"

import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import type { HealthStoryChapter } from "@/lib/health/progress"
import { transitions } from "@/lib/theme"

export function HealthStory({ chapters }: { chapters: HealthStoryChapter[] }) {
  return (
    <section className="space-y-8">
      <div>
        <SectionLabel>Health Story</SectionLabel>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          A chronological narrative generated from your data — month by month.
        </p>
      </div>

      {chapters.length === 0 ? (
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          As weight, labs, nutrition, and interventions accumulate, Geoffit
          writes the story of what happened and when.
        </p>
      ) : (
        <div className="max-w-2xl space-y-12">
          {chapters.map((chapter, index) => (
            <motion.article
              key={chapter.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.fadeUp, delay: index * 0.04 }}
              className="space-y-4"
            >
              <h3 className="text-[22px] font-medium tracking-tight text-foreground">
                {chapter.monthLabel}
              </h3>
              <div className="space-y-3">
                {chapter.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-[16px] leading-relaxed text-foreground/90"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </section>
  )
}
