import { Card, CardDescription, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { cn } from "@voyantjs/ui/lib/utils"
import type { DepartureProfitabilityReport } from "../../index.js"

const PIE_COLORS = [
  "hsl(221 83% 53%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 72% 51%)",
  "hsl(199 89% 48%)",
  "hsl(280 65% 60%)",
  "hsl(160 60% 45%)",
  "hsl(28 80% 52%)",
]

export function serviceTypeChart(
  departures: DepartureProfitabilityReport | undefined,
  baseMode: boolean,
  activeCurrency: string,
  labels: Record<string, string>,
) {
  const source = baseMode
    ? (departures?.base?.costByServiceType ?? [])
    : (departures?.costByServiceType ?? []).filter((c) => c.currency === activeCurrency)
  return source.map((c, index) => ({
    serviceType: c.serviceType,
    label: labels[c.serviceType as keyof typeof labels] ?? c.serviceType,
    amount: c.amountCents / 100,
    fill: PIE_COLORS[index % PIE_COLORS.length],
  }))
}

export function Kpi({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: "positive" | "negative"
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-2xl tabular-nums",
            accent === "positive" && "text-emerald-600 dark:text-emerald-500",
            accent === "negative" && "text-destructive",
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}
