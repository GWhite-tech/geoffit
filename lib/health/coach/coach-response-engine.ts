import { buildCoachActions } from "./coach-action-engine"
import { buildCitationsForContext } from "./coach-citation-engine"
import { buildCoachMemory } from "./coach-memory"
import { buildCoachPromptBundle } from "./coach-prompt-builder"
import type {
  CoachHealthContext,
  CoachMessage,
  CoachMessageBlock,
  CoachTopic,
} from "./types"

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function detectTopic(question: string): CoachTopic {
  const q = question.toLowerCase()
  if (/blood|hba1c|testosterone|lab|marker/.test(q)) return "blood"
  if (/sleep/.test(q)) return "sleep"
  if (/retatrutide|medication|dose|trt|metformin|peptide|protocol/.test(q)) {
    return /protocol/.test(q) ? "protocols" : "medication"
  }
  if (/protein|calorie|nutrition|fibre|fiber|macro/.test(q)) return "nutrition"
  if (/train|workout|gym/.test(q)) return "training"
  if (/recover/.test(q)) return "recovery"
  if (/weight|fat|lean|waist|loss/.test(q)) return "weight_loss"
  return "general"
}

function md(text: string): CoachMessageBlock {
  return { type: "markdown", id: id("md"), markdown: text }
}

function unavailableNote(context: CoachHealthContext, needed: string[]): string | null {
  const missing = needed.filter((item) =>
    context.unavailable.some((u) => u.toLowerCase().includes(item.toLowerCase()))
  )
  if (missing.length === 0) return null
  return `I do not have reliable data for: ${missing.join(", ")}. Import or log those before we treat them as facts.`
}

/**
 * CoachResponseEngine — grounded replies from Geoffit context only.
 * Not an LLM wrapper. Future models can consume CoachPromptBundle.
 */
export function generateCoachResponse(input: {
  question: string
  context: CoachHealthContext
}): CoachMessage {
  const topic = detectTopic(input.question)
  const memory = buildCoachMemory(input.context)
  // Prompt bundle kept for future LLM wiring / debugging export.
  void buildCoachPromptBundle({
    context: input.context,
    memory,
    userQuestion: input.question,
  })

  const context = input.context
  const q = input.question.toLowerCase()
  const blocks: CoachMessageBlock[] = []
  const paragraphs: string[] = []
  const citationKeys: Parameters<typeof buildCitationsForContext>[1] = [
    "progress",
  ]
  let confidence: "Low" | "Medium" | "High" = "Medium"
  let why: string | null = null
  const supporting: string[] = []

  if (!context.hasData) {
    paragraphs.push(
      "I do not have enough imported health history yet to coach you properly."
    )
    paragraphs.push(
      "Import Apple Health, blood tests, nutrition, and treatments — then ask again. I will not invent numbers."
    )
  } else if (/weight loss slowed|slowed|plateau/.test(q)) {
    citationKeys.push("weight", "nutrition", "treatments")
    if (context.weightTrend12w.deltaLb != null) {
      paragraphs.push(
        `Over the past ~12 weeks your weight change is ${context.weightTrend12w.deltaLb.toFixed(1)} lb (${context.weightTrend12w.start?.toFixed(1) ?? "—"} → ${context.weightTrend12w.end?.toFixed(1) ?? "—"} lb).`
      )
      supporting.push("Weight trend")
    } else {
      paragraphs.push(
        "I cannot see a clear 12-week weight series, so I will not claim a slowdown."
      )
      confidence = "Low"
    }
    if (context.caloriesAverage && context.nutritionTargets) {
      paragraphs.push(
        `Calories are averaging ${context.caloriesAverage.display} against a ${context.nutritionTargets.calories} kcal target.`
      )
      supporting.push("Nutrition trend")
    }
    if (context.proteinAverage) {
      paragraphs.push(
        `Protein is averaging ${context.proteinAverage.display}.`
      )
    }
    const med = context.interventions.find((i) =>
      /retatrutide|glp|medication|started/i.test(i.label)
    )
    if (med) {
      paragraphs.push(
        `${med.label} on ${med.date} is a relevant intervention on the timeline — compare weekly loss rate before and after that date in Progress.`
      )
      supporting.push("Intervention timeline")
    }
    why =
      "Weight-loss pace usually slows when the calorie gap narrows, adherence drifts, or adaptive expenditure rises. I am judging from your measured weight and nutrition averages only."
    confidence = supporting.length >= 2 ? "High" : "Medium"
    if (context.weightTrend12w.points.length >= 2) {
      blocks.push({
        type: "chart",
        id: id("chart"),
        chart: "weight",
        title: "Weight",
        points: context.weightTrend12w.points,
        unit: "lb",
      })
    }
  } else if (/blood test|latest blood|review my latest blood/.test(q)) {
    citationKeys.push("blood", "hba1c", "testosterone")
    if (!context.latestBloodTest) {
      paragraphs.push(
        "No blood tests are available in Geoffit yet. Import a PDF or CSV panel and I will review it against your trends."
      )
      confidence = "Low"
    } else {
      paragraphs.push(
        `Your latest panel is **${context.latestBloodTest.panel}** from ${context.latestBloodTest.date} (${context.latestBloodTest.provider}).`
      )
      for (const marker of context.latestBloodTest.highlightMarkers) {
        blocks.push({
          type: "blood_card",
          id: id("blood"),
          marker: marker.label,
          value: marker.value,
          status: marker.status,
          change: null,
          href: `/blood/${marker.key}`,
        })
      }
      if (context.hba1c.latest) {
        paragraphs.push(
          context.hba1c.previous
            ? `HbA1c moved from ${context.hba1c.previous} to ${context.hba1c.latest}${context.hba1c.deltaDisplay ? ` (${context.hba1c.deltaDisplay})` : ""}.`
            : `Latest HbA1c is ${context.hba1c.latest}.`
        )
        supporting.push("Blood results")
      }
      if (context.testosterone.latest) {
        paragraphs.push(
          `Testosterone is ${context.testosterone.latest}${
            context.testosterone.status
              ? ` — ${context.testosterone.status}`
              : ""
          }.`
        )
      }
      why =
        "I am reading only imported markers and their prior values. Clinical decisions still belong with your clinician."
      confidence = "High"
      if (context.hba1c.points.length >= 2) {
        blocks.push({
          type: "chart",
          id: id("chart"),
          chart: "hba1c",
          title: "HbA1c",
          points: context.hba1c.points,
          unit: "mmol/mol",
        })
      }
    }
  } else if (/retatrutide|affecting my progress|medication.*progress/.test(q)) {
    citationKeys.push("weight", "treatments", "nutrition", "hba1c", "progress")
    const med =
      context.medications.find((m) => /retatrutide/i.test(m.name)) ??
      context.medications[0]
    const start = context.interventions.find((i) =>
      /retatrutide|started/i.test(i.label)
    )
    if (!med && !start) {
      paragraphs.push(
        "I do not see Retatrutide (or a matching medication start) in your treatment history. Add it under Treatments if you are on it — I will not invent an effect."
      )
      confidence = "Low"
    } else {
      if (med) {
        paragraphs.push(
          `You are on **${med.name}** at ${med.dose}${
            med.startedAt ? `, started ${med.startedAt}` : ""
          }.`
        )
      }
      if (context.weightTrend12w.deltaLb != null) {
        paragraphs.push(
          context.weightTrend12w.deltaLb < 0
            ? `You have lost ${Math.abs(context.weightTrend12w.deltaLb).toFixed(1)} lb over the past ~12 weeks.`
            : `Weight has changed by ${context.weightTrend12w.deltaLb.toFixed(1)} lb over ~12 weeks.`
        )
        supporting.push("Weight trend")
      }
      if (context.correlations[0]) {
        paragraphs.push(context.correlations[0])
        supporting.push("Correlation analysis")
      }
      if (context.leanMassTrend.stable === true) {
        paragraphs.push(
          "Lean mass has remained stable despite continued weight change — a favourable composition signal."
        )
      }
      if (context.hba1c.latest && context.hba1c.previous) {
        paragraphs.push(
          `HbA1c has moved from ${context.hba1c.previous} to ${context.hba1c.latest}.`
        )
        supporting.push("Blood results")
      }
      why =
        "Medication effects are inferred from timeline alignment with weight, labs, and nutrition — not from a controlled trial of your dose."
      confidence = supporting.length >= 2 ? "High" : "Medium"
      if (context.weightTrend12w.points.length >= 2) {
        blocks.push({
          type: "chart",
          id: id("chart"),
          chart: "weight",
          title: "Weight since intervention window",
          points: context.weightTrend12w.points,
          unit: "lb",
        })
      }
    }
  } else if (/increase protein|should i increase protein/.test(q)) {
    citationKeys.push("nutrition", "weight")
    if (!context.proteinAverage || !context.nutritionTargets) {
      paragraphs.push(
        unavailableNote(context, ["nutrition"]) ??
          "Protein history is unavailable, so I will not recommend a target change."
      )
      confidence = "Low"
    } else {
      const target = context.nutritionTargets.protein
      const avg = context.proteinAverage.value
      paragraphs.push(
        `Your protein average is **${context.proteinAverage.display}** over ${context.proteinAverage.days} days, against a target of ${target} g.`
      )
      if (avg >= target * 0.95) {
        paragraphs.push(
          "You are already near or above target. Increasing further is optional — only useful if lean-mass goals demand it or hunger management needs more protein density."
        )
        why =
          "Intake is already meeting the target you set in Nutrition. Extra protein is not automatically better."
        confidence = "High"
      } else {
        paragraphs.push(
          `You are averaging about ${Math.round(target - avg)} g/day below target. Closing that gap is the first move — before raising the target itself.`
        )
        why =
          "Under-hitting the current target is a clearer issue than the target being too low."
        confidence = "High"
      }
      if (context.leanMassTrend.stable === true) {
        paragraphs.push(
          "Lean mass looks stable, which supports keeping protein at least at the current target while in a deficit."
        )
      }
      supporting.push("Nutrition trend")
      blocks.push({
        type: "metric_card",
        id: id("metric"),
        label: "Protein average",
        value: context.proteinAverage.display,
        detail: `Target ${target} g`,
        href: "/nutrition",
      })
    }
  } else if (/sleep changed|sleep this month|how has my sleep/.test(q)) {
    citationKeys.push("sleep", "recovery")
    if (!context.sleepAverage) {
      paragraphs.push(
        "Sleep average is unavailable. Import sleep analysis from Apple Health."
      )
      confidence = "Low"
    } else {
      paragraphs.push(
        `Over the last ${context.sleepAverage.nights} nights, sleep is averaging **${context.sleepAverage.display}**.`
      )
      const sleepChange = context.whatsChanged.find((item) =>
        /sleep/i.test(item.label)
      )
      if (sleepChange) {
        paragraphs.push(
          `Versus the previous period, sleep changed by ${sleepChange.change}.`
        )
        supporting.push("Sleep trend")
      }
      if (context.recovery?.score != null) {
        paragraphs.push(
          `Recovery sits at ${context.recovery.score}% (${context.recovery.label}).`
        )
        supporting.push("Recovery")
      }
      why =
        "Sleep duration is taken from imported nights; recovery is computed from HRV, resting HR, and sleep when available."
      confidence = supporting.length >= 1 ? "High" : "Medium"
      blocks.push({
        type: "metric_card",
        id: id("metric"),
        label: "Sleep average",
        value: context.sleepAverage.display,
        detail: `${context.sleepAverage.nights} nights`,
        href: "/sleep",
      })
    }
  } else if (/focus on this week|what should i focus/.test(q)) {
    citationKeys.push(
      "progress",
      "nutrition",
      "recovery",
      "sleep",
      "weight"
    )
    if (memory.focusAreas.length === 0) {
      paragraphs.push(
        "Based on available data, there is no single urgent gap. Keep executing the current protocol with consistency."
      )
      if (context.weightTrend12w.deltaLb != null && context.weightTrend12w.deltaLb < 0) {
        paragraphs.push(
          `Weight trend remains favourable (${context.weightTrend12w.deltaLb.toFixed(1)} lb over ~12 weeks). Protect protein and sleep while the deficit continues.`
        )
      }
      confidence = "Medium"
    } else {
      paragraphs.push(
        `This week, focus on: **${memory.focusAreas.join(", ")}**.`
      )
      for (const area of memory.focusAreas) {
        if (area === "Protein adherence" && context.proteinAverage) {
          paragraphs.push(
            `Protein is at ${context.proteinAverage.display} — get closer to ${context.nutritionTargets?.protein ?? "target"} g most days.`
          )
        }
        if (area === "Sleep duration" && context.sleepAverage) {
          paragraphs.push(
            `Sleep is averaging ${context.sleepAverage.display}. Protect a consistent bedtime window.`
          )
        }
        if (area === "Recovery" && context.recovery?.score != null) {
          paragraphs.push(
            `Recovery is ${context.recovery.score}%. Bias toward sleep and lower junk volume before adding intensity.`
          )
        }
        if (area === "Weight-loss momentum") {
          paragraphs.push(
            "Weight-loss momentum looks soft relative to a clear deficit phase — verify calorie adherence before changing medications."
          )
        }
      }
      why =
        "Focus areas are ranked from measured gaps in protein, sleep, recovery, and weight trend — not from generic advice."
      confidence = "High"
      supporting.push(...memory.focusAreas)
    }
  } else if (/testosterone/.test(q)) {
    citationKeys.push("testosterone", "blood")
    if (!context.testosterone.latest) {
      paragraphs.push(
        "No testosterone results are available. Import a blood panel that includes testosterone."
      )
      confidence = "Low"
    } else {
      paragraphs.push(
        `Your latest testosterone is **${context.testosterone.latest}**${
          context.testosterone.status
            ? ` (${context.testosterone.status})`
            : ""
        }.`
      )
      paragraphs.push(
        "Interpretation depends on free testosterone, SHBG, symptoms, and timing of the draw — open Blood Markers for the full clinical/lab context."
      )
      why =
        "I am reporting the imported value and registry status only. I will not invent a diagnosis."
      confidence = "High"
      supporting.push("Blood results")
      blocks.push({
        type: "blood_card",
        id: id("blood"),
        marker: "Testosterone",
        value: context.testosterone.latest,
        status: context.testosterone.status,
        change: null,
        href: context.testosterone.href,
      })
    }
  } else if (/review my nutrition|nutrition/.test(q)) {
    citationKeys.push("nutrition", "weight")
    if (!context.proteinAverage && !context.caloriesAverage) {
      paragraphs.push(
        "Nutrition records are unavailable. Re-import Apple Health with dietary metrics enabled."
      )
      confidence = "Low"
    } else {
      if (context.caloriesAverage) {
        paragraphs.push(
          `Calories are averaging **${context.caloriesAverage.display}** over ${context.caloriesAverage.days} days${
            context.nutritionTargets
              ? ` (target ${context.nutritionTargets.calories} kcal)`
              : ""
          }.`
        )
      }
      if (context.proteinAverage) {
        paragraphs.push(
          `Protein is averaging **${context.proteinAverage.display}**${
            context.nutritionTargets
              ? ` (target ${context.nutritionTargets.protein} g)`
              : ""
          }.`
        )
      }
      if (context.weightTrend12w.deltaLb != null) {
        paragraphs.push(
          `That intake sits alongside a ${context.weightTrend12w.deltaLb.toFixed(1)} lb weight change over ~12 weeks.`
        )
        supporting.push("Weight trend")
      }
      why =
        "Nutrition averages come from imported dietary samples aggregated by day — not from a food diary guess."
      confidence = "High"
      supporting.push("Nutrition trend")
      if (context.proteinAverage) {
        blocks.push({
          type: "metric_card",
          id: id("metric"),
          label: "Protein",
          value: context.proteinAverage.display,
          detail: null,
          href: "/nutrition",
        })
      }
      if (context.caloriesAverage) {
        blocks.push({
          type: "metric_card",
          id: id("metric2"),
          label: "Calories",
          value: context.caloriesAverage.display,
          detail: null,
          href: "/nutrition",
        })
      }
    }
  } else {
    // General grounded briefing
    citationKeys.push(
      "weight",
      "nutrition",
      "recovery",
      "hba1c",
      "treatments",
      "progress"
    )
    paragraphs.push(
      "Here is what your Geoffit data supports right now — nothing invented."
    )
    if (context.weightTrend12w.deltaLb != null) {
      paragraphs.push(
        context.weightTrend12w.deltaLb < 0
          ? `You have lost ${Math.abs(context.weightTrend12w.deltaLb).toFixed(1)} lb over the past ~12 weeks.`
          : `Weight has changed by ${context.weightTrend12w.deltaLb.toFixed(1)} lb over ~12 weeks.`
      )
    }
    if (context.proteinAverage) {
      paragraphs.push(
        `Average protein has been ${context.proteinAverage.display}.`
      )
    }
    if (context.leanMassTrend.stable === true) {
      paragraphs.push("Lean mass has remained stable.")
    }
    if (context.hba1c.latest && context.hba1c.previous) {
      paragraphs.push(
        `HbA1c has moved from ${context.hba1c.previous} to ${context.hba1c.latest}.`
      )
    } else if (context.hba1c.latest) {
      paragraphs.push(`Latest HbA1c is ${context.hba1c.latest}.`)
    }
    if (context.recovery?.score != null) {
      paragraphs.push(
        `Recovery has been around ${context.recovery.score}%.`
      )
    }
    if (context.medications.length) {
      paragraphs.push(
        `Current protocol: ${context.medications
          .map((m) => `${m.name} ${m.dose}`)
          .join(", ")}.`
      )
    }
    if (paragraphs.length === 1) {
      paragraphs.push(
        "Key series are still thin. Ask a specific question once more data is imported."
      )
      confidence = "Low"
    } else {
      paragraphs.push(
        "Based on your historical data, keep executing what is already working — then pressure-test the weakest signal."
      )
      why =
        "This briefing only uses measured weight, nutrition, labs, recovery, and treatments from your stores."
      confidence = "Medium"
      supporting.push("Progress analytics")
    }
    if (context.weightTrend12w.points.length >= 2) {
      blocks.push({
        type: "chart",
        id: id("chart"),
        chart: "weight",
        title: "Weight",
        points: context.weightTrend12w.points,
        unit: "lb",
      })
    }
  }

  const note = unavailableNote(context, [])
  void note

  const markdown = paragraphs.join("\n\n")
  const leadBlocks: CoachMessageBlock[] = [md(markdown)]

  if (why) {
    leadBlocks.push({
      type: "evidence",
      id: id("evidence"),
      confidence,
      why,
      supporting: supporting.length ? supporting : ["Available Geoffit stores"],
    })
  }

  const citations = buildCitationsForContext(context, citationKeys)
  const actions = buildCoachActions(context, topic)

  const allBlocks = [
    ...leadBlocks,
    ...blocks,
    {
      type: "actions" as const,
      id: id("actions"),
      actions,
    },
    {
      type: "citations" as const,
      id: id("citations"),
      citations,
    },
  ]

  return {
    id: id("msg"),
    role: "coach",
    createdAt: new Date().toISOString(),
    text: paragraphs.join(" "),
    blocks: allBlocks,
    followUps: buildFollowUps(topic, context),
  }
}

function buildFollowUps(
  topic: CoachTopic,
  context: CoachHealthContext
): string[] {
  const options: string[] = []
  if (context.medications.some((m) => /retatrutide/i.test(m.name))) {
    options.push("Should I increase my Retatrutide dose?")
  } else if (context.medications[0]) {
    options.push(`How is ${context.medications[0].name} showing up in my trends?`)
  }
  options.push("How can I improve my recovery?")
  if (context.testosterone.latest) {
    options.push("What is influencing my testosterone?")
  } else {
    options.push("Review my latest blood tests.")
  }
  if (topic === "nutrition") {
    options.push("Should I change my calorie target?")
  } else {
    options.push("What should I focus on this week?")
  }
  return [...new Set(options)].slice(0, 3)
}

export function titleForQuestion(question: string): string {
  const topic = detectTopic(question)
  const labels: Record<CoachTopic, string> = {
    weight_loss: "Weight Loss Strategy",
    blood: "Blood Test Review",
    sleep: "Sleep Analysis",
    medication: "Medication Questions",
    nutrition: "Nutrition Review",
    training: "Training Plan",
    recovery: "Recovery",
    protocols: "Protocols",
    general: question.slice(0, 42) || "General",
  }
  return labels[topic]
}

export { detectTopic }
