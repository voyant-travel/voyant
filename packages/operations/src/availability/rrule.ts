export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const
export type Weekday = (typeof WEEKDAYS)[number]

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
}

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY"

export type ParsedRRule = {
  frequency: Frequency
  interval: number
  byWeekdays: Weekday[]
  byMonthDays: number[]
}

const SUPPORTED_FREQUENCIES: readonly Frequency[] = ["DAILY", "WEEKLY", "MONTHLY"]

export type RRuleValidationResult =
  | { ok: true; parsed: ParsedRRule }
  | { ok: false; message: string }

function parseRRuleParts(rrule: string): { map: Map<string, string> } | { error: string } {
  const parts = rrule
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
  const map = new Map<string, string>()
  for (const part of parts) {
    const separatorIndex = part.indexOf("=")
    if (separatorIndex < 1) {
      return { error: `Invalid RRULE part: ${part}` }
    }
    const key = part.slice(0, separatorIndex).trim().toUpperCase()
    const value = part.slice(separatorIndex + 1).trim()
    if (!value) {
      return { error: `Invalid RRULE part: ${part}` }
    }
    map.set(key, value)
  }
  return { map }
}

export function validateRRule(rrule: string): RRuleValidationResult {
  const parsedParts = parseRRuleParts(rrule)
  if ("error" in parsedParts) return { ok: false, message: parsedParts.error }

  const { map } = parsedParts
  const rawFreq = map.get("FREQ")?.toUpperCase()
  if (!rawFreq) return { ok: false, message: "RRULE must include FREQ" }
  if (!(SUPPORTED_FREQUENCIES as readonly string[]).includes(rawFreq)) {
    return { ok: false, message: `Unsupported RRULE frequency: ${rawFreq}` }
  }

  const rawInterval = map.get("INTERVAL")
  const interval = rawInterval === undefined ? 1 : Number.parseInt(rawInterval, 10)
  if (
    !Number.isFinite(interval) ||
    interval < 1 ||
    (rawInterval !== undefined && String(interval) !== rawInterval)
  ) {
    return { ok: false, message: "RRULE INTERVAL must be a positive integer" }
  }

  const byday = map.get("BYDAY") ?? ""
  const rawWeekdays = byday
    .split(",")
    .map((d) => d.trim().toUpperCase())
    .filter(Boolean)
  const byWeekdays = rawWeekdays.filter((d): d is Weekday =>
    (WEEKDAYS as readonly string[]).includes(d),
  )
  if (rawWeekdays.length !== byWeekdays.length) {
    return { ok: false, message: "RRULE BYDAY contains unsupported weekdays" }
  }

  const bymonthday = map.get("BYMONTHDAY") ?? ""
  const rawMonthDays = bymonthday
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
  const byMonthDays = rawMonthDays.map((d) => Number.parseInt(d, 10))
  if (
    byMonthDays.some(
      (n, index) => !Number.isFinite(n) || n < 1 || n > 31 || String(n) !== rawMonthDays[index],
    )
  ) {
    return { ok: false, message: "RRULE BYMONTHDAY must contain days 1 through 31" }
  }

  const frequency = rawFreq as Frequency
  if (frequency === "WEEKLY" && byWeekdays.length === 0) {
    return { ok: false, message: "Weekly RRULE must include BYDAY" }
  }
  if (frequency === "MONTHLY" && byMonthDays.length === 0) {
    return { ok: false, message: "Monthly RRULE must include BYMONTHDAY" }
  }

  return {
    ok: true,
    parsed: { frequency, interval, byWeekdays, byMonthDays },
  }
}

/**
 * Parse a minimal RRULE string (subset of RFC 5545).
 * Supports FREQ, INTERVAL, BYDAY, BYMONTHDAY.
 */
export function parseRRule(rrule: string): ParsedRRule {
  const parts = rrule
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
  const map = new Map<string, string>()
  for (const part of parts) {
    const [key, value] = part.split("=")
    if (key && value !== undefined) map.set(key.toUpperCase(), value)
  }

  const rawFreq = (map.get("FREQ") ?? "DAILY").toUpperCase()
  const frequency: Frequency =
    rawFreq === "WEEKLY" || rawFreq === "MONTHLY" ? (rawFreq as Frequency) : "DAILY"

  const interval = Number.parseInt(map.get("INTERVAL") ?? "1", 10) || 1

  const byday = map.get("BYDAY") ?? ""
  const byWeekdays = byday
    .split(",")
    .map((d) => d.trim().toUpperCase())
    .filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d))

  const bymonthday = map.get("BYMONTHDAY") ?? ""
  const byMonthDays = bymonthday
    .split(",")
    .map((d) => Number.parseInt(d.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 31)

  return { frequency, interval, byWeekdays, byMonthDays }
}

/**
 * Build an RRULE string from structured values.
 */
export function buildRRule(values: ParsedRRule): string {
  const parts = [`FREQ=${values.frequency}`]
  if (values.interval > 1) parts.push(`INTERVAL=${values.interval}`)
  if (values.frequency === "WEEKLY" && values.byWeekdays.length > 0) {
    const ordered = WEEKDAYS.filter((d) => values.byWeekdays.includes(d))
    parts.push(`BYDAY=${ordered.join(",")}`)
  }
  if (values.frequency === "MONTHLY" && values.byMonthDays.length > 0) {
    const ordered = [...values.byMonthDays].sort((a, b) => a - b)
    parts.push(`BYMONTHDAY=${ordered.join(",")}`)
  }
  return parts.join(";")
}

/**
 * Human-readable preview: "Every Monday" / "Every 2 weeks on Mon, Wed, Fri"
 */
export function describeRRule(rrule: string | ParsedRRule): string {
  const parsed = typeof rrule === "string" ? parseRRule(rrule) : rrule
  const { frequency, interval, byWeekdays, byMonthDays } = parsed
  const unit = frequency === "DAILY" ? "day" : frequency === "WEEKLY" ? "week" : "month"
  const cadence = interval > 1 ? `Every ${interval} ${unit}s` : `Every ${unit}`

  if (frequency === "WEEKLY") {
    if (byWeekdays.length === 0) return `${cadence} (no weekdays)`
    const ordered = WEEKDAYS.filter((d) => byWeekdays.includes(d))
    if (interval === 1 && ordered.length === 1) {
      // "Every Monday"
      const fullNames: Record<Weekday, string> = {
        MO: "Monday",
        TU: "Tuesday",
        WE: "Wednesday",
        TH: "Thursday",
        FR: "Friday",
        SA: "Saturday",
        SU: "Sunday",
      }
      return `Every ${fullNames[ordered[0] as Weekday]}`
    }
    const labels = ordered.map((d) => WEEKDAY_LABELS[d])
    return `${cadence} on ${labels.join(", ")}`
  }
  if (frequency === "MONTHLY") {
    if (byMonthDays.length === 0) return `${cadence} (no days)`
    const ordered = [...byMonthDays].sort((a, b) => a - b)
    return `${cadence} on day${ordered.length === 1 ? "" : "s"} ${ordered.join(", ")}`
  }
  return cadence
}

function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function startOfDayUtc(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function weekdayFromJsDay(jsDay: number): Weekday {
  // JS getUTCDay: 0=Sun, 1=Mon, ... 6=Sat
  const map: Record<number, Weekday> = {
    0: "SU",
    1: "MO",
    2: "TU",
    3: "WE",
    4: "TH",
    5: "FR",
    6: "SA",
  }
  return map[jsDay] ?? "MO"
}

function mondayOfWeekUtc(date: Date): Date {
  // JS Monday = 1, Sunday = 0. Convert Sunday → 7 for ISO week alignment.
  const d = startOfDayUtc(date)
  const jsDay = d.getUTCDay()
  const iso = jsDay === 0 ? 7 : jsDay
  return addDaysUtc(d, -(iso - 1))
}

function formatDateLocal(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Expand an RRULE into a sorted list of local date strings (YYYY-MM-DD).
 * Operates on UTC-anchored wall-clock dates — timezone conversion is
 * the caller's responsibility.
 */
export function expandRRule(
  rrule: string | ParsedRRule,
  fromDate: Date,
  toDate: Date,
  limit = 1000,
): string[] {
  const parsed = typeof rrule === "string" ? parseRRule(rrule) : rrule
  const start = startOfDayUtc(fromDate)
  const end = startOfDayUtc(toDate)
  if (end < start) return []
  const interval = Math.max(1, parsed.interval)
  const out: string[] = []

  if (parsed.frequency === "DAILY") {
    let cursor = start
    while (cursor <= end && out.length < limit) {
      out.push(formatDateLocal(cursor))
      cursor = addDaysUtc(cursor, interval)
    }
    return out
  }

  if (parsed.frequency === "WEEKLY") {
    if (parsed.byWeekdays.length === 0) return []
    const target = new Set(parsed.byWeekdays)
    let weekStart = mondayOfWeekUtc(start)
    while (weekStart <= end && out.length < limit) {
      for (let i = 0; i < 7; i++) {
        const day = addDaysUtc(weekStart, i)
        if (day < start || day > end) continue
        const wd = weekdayFromJsDay(day.getUTCDay())
        if (target.has(wd)) out.push(formatDateLocal(day))
        if (out.length >= limit) break
      }
      weekStart = addDaysUtc(weekStart, 7 * interval)
    }
    return out
  }

  // MONTHLY
  if (parsed.byMonthDays.length === 0) return []
  const monthDays = [...parsed.byMonthDays].sort((a, b) => a - b)
  let year = start.getUTCFullYear()
  let month = start.getUTCMonth()
  while (out.length < limit) {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    for (const dom of monthDays) {
      if (dom > daysInMonth) continue
      const d = new Date(Date.UTC(year, month, dom))
      if (d < start) continue
      if (d > end) return out
      out.push(formatDateLocal(d))
      if (out.length >= limit) return out
    }
    month += interval
    while (month > 11) {
      month -= 12
      year += 1
    }
    const firstOfNextIterMonth = new Date(Date.UTC(year, month, 1))
    if (firstOfNextIterMonth > end) break
  }
  return out
}
