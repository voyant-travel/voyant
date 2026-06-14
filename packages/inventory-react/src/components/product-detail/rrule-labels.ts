const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const
type Weekday = (typeof WEEKDAYS)[number]

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
}

const WEEKDAY_FULL_LABELS: Record<Weekday, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
}

type Frequency = "DAILY" | "WEEKLY" | "MONTHLY"

interface ParsedRRule {
  frequency: Frequency
  interval: number
  byWeekdays: Weekday[]
  byMonthDays: number[]
}

function parseRRule(rrule: string): ParsedRRule {
  const parts = rrule
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
  const map = new Map<string, string>()
  for (const part of parts) {
    const [key, value] = part.split("=")
    if (key && value !== undefined) map.set(key.toUpperCase(), value)
  }

  const rawFrequency = (map.get("FREQ") ?? "DAILY").toUpperCase()
  const frequency: Frequency =
    rawFrequency === "WEEKLY" || rawFrequency === "MONTHLY" ? rawFrequency : "DAILY"
  const interval = Number.parseInt(map.get("INTERVAL") ?? "1", 10) || 1
  const byWeekdays = (map.get("BYDAY") ?? "")
    .split(",")
    .map((day) => day.trim().toUpperCase())
    .filter((day): day is Weekday => (WEEKDAYS as readonly string[]).includes(day))
  const byMonthDays = (map.get("BYMONTHDAY") ?? "")
    .split(",")
    .map((day) => Number.parseInt(day.trim(), 10))
    .filter((day) => Number.isFinite(day) && day >= 1 && day <= 31)

  return { frequency, interval, byWeekdays, byMonthDays }
}

export function describeRRule(rrule: string): string {
  const { frequency, interval, byWeekdays, byMonthDays } = parseRRule(rrule)
  const unit = frequency === "DAILY" ? "day" : frequency === "WEEKLY" ? "week" : "month"
  const cadence = interval > 1 ? `Every ${interval} ${unit}s` : `Every ${unit}`

  if (frequency === "WEEKLY") {
    if (byWeekdays.length === 0) return `${cadence} (no weekdays)`
    const ordered = WEEKDAYS.filter((day) => byWeekdays.includes(day))
    const first = ordered[0]
    if (interval === 1 && ordered.length === 1 && first) {
      return `Every ${WEEKDAY_FULL_LABELS[first]}`
    }
    return `${cadence} on ${ordered.map((day) => WEEKDAY_LABELS[day]).join(", ")}`
  }

  if (frequency === "MONTHLY") {
    if (byMonthDays.length === 0) return `${cadence} (no days)`
    const ordered = [...byMonthDays].sort((a, b) => a - b)
    return `${cadence} on day${ordered.length === 1 ? "" : "s"} ${ordered.join(", ")}`
  }

  return cadence
}
