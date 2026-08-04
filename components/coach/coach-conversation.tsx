"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { ArrowUp } from "lucide-react"

import { CoachMessageBlocks } from "@/components/coach/coach-message-blocks"
import {
  askCoach,
  getSuggestedQuestions,
  useActiveConversation,
  useCoachComposing,
  useCoachContext,
} from "@/lib/health/coach"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function CoachConversation() {
  const conversation = useActiveConversation()
  const composing = useCoachComposing()
  const { context } = useCoachContext()
  const [draft, setDraft] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const suggestions = getSuggestedQuestions()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [conversation?.messages.length, composing])

  function submit(question?: string) {
    const text = (question ?? draft).trim()
    if (!text || composing) return
    setDraft("")
    askCoach(text)
  }

  const empty = !conversation || conversation.messages.length === 0

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[760px] flex-col px-5 py-8 lg:px-8">
          {empty ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitions.fadeUp}
              className="flex min-h-[50vh] flex-col justify-end gap-10 pb-6"
            >
              <div>
                <h1 className="text-[34px] font-semibold tracking-tight text-foreground sm:text-[40px]">
                  AI Coach
                </h1>
                <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
                  I already have your Geoffit history
                  {context?.currentWeight
                    ? ` — currently ${context.currentWeight.display}`
                    : ""}
                  {context?.healthScore?.score != null
                    ? `, health score ${context.healthScore.score}`
                    : ""}
                  . Ask anything. I will not invent data.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                  Suggested
                </p>
                <div className="flex flex-col gap-2">
                  {suggestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => submit(question)}
                      className="rounded-xl px-1 py-2.5 text-left text-[15px] text-foreground/90 transition-colors hover:text-primary"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-10 pb-6">
              {conversation.messages.map((message) => (
                <motion.article
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transitions.fadeUp}
                  className={cn(
                    message.role === "user" && "ml-auto max-w-[85%]"
                  )}
                >
                  {message.role === "user" ? (
                    <p className="rounded-2xl bg-card/50 px-4 py-3 text-[15px] leading-relaxed text-foreground">
                      {message.text}
                    </p>
                  ) : (
                    <div className="space-y-5">
                      <CoachMessageBlocks
                        blocks={message.blocks}
                        onAction={(label) => submit(label)}
                      />
                      {message.followUps.length > 0 ? (
                        <div className="space-y-2 pt-2">
                          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
                            Follow up
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {message.followUps.map((followUp) => (
                              <button
                                key={followUp}
                                type="button"
                                onClick={() => submit(followUp)}
                                className="text-left text-[14px] text-muted-foreground transition-colors hover:text-primary"
                              >
                                {followUp}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </motion.article>
              ))}
              {composing ? (
                <p className="text-[14px] text-muted-foreground">Thinking…</p>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/30 px-5 py-4 lg:px-8">
        <div className="mx-auto flex w-full max-w-[760px] items-end gap-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder="Ask your coach…"
            className="max-h-40 min-h-[48px] flex-1 resize-none rounded-2xl border border-border/40 bg-card/30 px-4 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />
          <button
            type="button"
            disabled={!draft.trim() || composing}
            onClick={() => submit()}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
