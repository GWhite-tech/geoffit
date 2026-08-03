interface MissionRingProps {
  score: number
  size?: "md" | "lg"
}

export function MissionRing({ score, size = "lg" }: MissionRingProps) {
  const radius = size === "lg" ? 58 : 48
  const dimension = size === "lg" ? 144 : 120
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: dimension, height: dimension }}
    >
      <svg
        className="-rotate-90"
        width={dimension}
        height={dimension}
        viewBox="0 0 120 120"
      >
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-foreground/[0.06]"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#missionGradient)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="missionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={
            size === "lg"
              ? "text-5xl font-semibold tracking-tight tabular-nums"
              : "text-4xl font-semibold tracking-tight tabular-nums"
          }
        >
          {score}
        </span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}
