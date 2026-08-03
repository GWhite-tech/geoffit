export const colours = {
  brand: {
    primary: "#7C3AED",
    hover: "#8B5CF6",
    pressed: "#6D28D9",
    foreground: "#FFFFFF",
  },
  background: "#09090B",
  card: "#18181B",
  border: "#27272A",
  text: {
    primary: "#FAFAFA",
    muted: "#A1A1AA",
  },
  status: {
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
} as const

export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  14: "3.5rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
} as const

export const borderRadius = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.25rem",
  "3xl": "1.5rem",
  full: "9999px",
} as const

export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.25)",
  md: "0 4px 12px -2px rgb(0 0 0 / 0.35)",
  lg: "0 12px 32px -8px rgb(0 0 0 / 0.45)",
  card: "0 8px 24px -12px rgb(0 0 0 / 0.5)",
  cardHover: "0 16px 40px -16px rgb(0 0 0 / 0.55)",
} as const

export const transitions = {
  fast: "150ms cubic-bezier(0.25, 0.1, 0.25, 1)",
  base: "250ms cubic-bezier(0.25, 0.1, 0.25, 1)",
  slow: "450ms cubic-bezier(0.25, 0.1, 0.25, 1)",
  spring: { type: "spring" as const, stiffness: 380, damping: 28 },
  fadeUp: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
  hoverLift: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
} as const

export const theme = {
  colours,
  spacing,
  borderRadius,
  shadows,
  transitions,
} as const

export type Theme = typeof theme

export type Trend = "up" | "down" | "neutral"

export type MetricStatus = "success" | "warning" | "danger" | "neutral"
