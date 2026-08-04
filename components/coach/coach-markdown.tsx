"use client"

import type { ReactNode } from "react"

/** Lightweight markdown: paragraphs, **bold**, bullet lines. No HTML injection. */
export function CoachMarkdown({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n\n+/).filter(Boolean)

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const lines = block.split("\n")
        const isList = lines.every(
          (line) => line.trim().startsWith("- ") || line.trim().startsWith("• ")
        )
        if (isList) {
          return (
            <ul key={index} className="space-y-1.5 pl-1">
              {lines.map((line, lineIndex) => (
                <li
                  key={lineIndex}
                  className="text-[15px] leading-relaxed text-foreground/90"
                >
                  {renderInline(line.replace(/^\s*[-•]\s*/, ""))}
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p
            key={index}
            className="text-[15px] leading-relaxed text-foreground/90"
          >
            {renderInline(block.replace(/\n/g, " "))}
          </p>
        )
      })}
    </div>
  )
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-medium text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={index}>{part}</span>
  })
}
