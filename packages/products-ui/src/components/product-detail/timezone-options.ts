import { timezones } from "@voyantjs/utils/timezones"

export type TimezoneOption = {
  id: string
  label: string
  offset: number
}

function buildTimezoneOptions(): TimezoneOption[] {
  const seen = new Map<string, TimezoneOption>()
  for (const tz of timezones) {
    for (const id of tz.utc) {
      if (seen.has(id)) continue
      seen.set(id, { id, label: tz.text, offset: tz.offset })
    }
  }
  // Include the browser-resolved zone if not already present
  const browserZone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null
  if (browserZone && !seen.has(browserZone)) {
    seen.set(browserZone, { id: browserZone, label: browserZone, offset: 0 })
  }
  return Array.from(seen.values()).sort((a, b) => {
    if (a.offset !== b.offset) return a.offset - b.offset
    return a.id.localeCompare(b.id)
  })
}

export const TIMEZONE_OPTIONS = buildTimezoneOptions()
export const TIMEZONE_IDS = TIMEZONE_OPTIONS.map((t) => t.id)

const TIMEZONE_BY_ID = new Map(TIMEZONE_OPTIONS.map((t) => [t.id, t] as const))

export function getTimezoneLabel(id: string): string {
  const tz = TIMEZONE_BY_ID.get(id)
  return tz ? `${id} — ${tz.label}` : id
}
