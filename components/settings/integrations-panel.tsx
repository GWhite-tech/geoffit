"use client"

const INTEGRATIONS = [
  { name: "Apple Health", status: "Available via Data Sources" },
  { name: "Garmin", status: "Coming soon" },
  { name: "Whoop", status: "Coming soon" },
  { name: "Oura", status: "Coming soon" },
  { name: "Dexcom", status: "Coming soon" },
  { name: "MyFitnessPal", status: "Coming soon" },
  { name: "Cronometer", status: "Coming soon" },
  { name: "MacroFactor", status: "Coming soon" },
  { name: "Calendar", status: "Coming soon" },
  { name: "Slack / webhooks", status: "Coming soon" },
] as const

export function IntegrationsPanel() {
  return (
    <div className="space-y-6">
      <p className="max-w-xl text-[14px] leading-relaxed text-muted-foreground">
        Future integrations will appear here with availability. Live health
        connectors are managed under Data Sources.
      </p>
      <ul className="divide-y divide-border/25">
        {INTEGRATIONS.map((item) => (
          <li
            key={item.name}
            className="flex items-center justify-between gap-4 py-4"
          >
            <p className="text-[15px] font-medium text-foreground">{item.name}</p>
            <p className="text-[13px] text-muted-foreground">{item.status}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
