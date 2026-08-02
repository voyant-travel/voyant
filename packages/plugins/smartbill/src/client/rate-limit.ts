export interface ParsedSmartbillRateLimit {
  errorText: string
  retryAfterMs?: number
  retryAfterAt?: Date
  blockedAt?: Date
}

const RATE_LIMIT_TEXT_PATTERN =
  /limita\s+maxima\s+de\s+requesturi|vei\s+putea\s+executa\s+alte\s+requesturi/i
const RATE_LIMIT_MINUTES_PATTERN = /dupa\s+(\d+)\s*min/i
const RATE_LIMIT_DATE_PATTERN =
  /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})|(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseSmartbillDate(value: string) {
  const match = RATE_LIMIT_DATE_PATTERN.exec(value)
  if (!match) return undefined

  // Treat SmartBill's date string as UTC. The original code used `new
  // Date(y, m, d, ...)` which interprets components as the JS host's
  // local time, so the same response decoded to different instants on a
  // CI runner (UTC) vs. a developer machine (Europe/Bucharest, EEST).
  // The retry-window math downstream is duration-based (`retryAfterAt -
  // now`), so anchoring to UTC keeps the math deterministic and matches
  // the existing test fixtures that assert UTC timestamps.
  if (match[1]) {
    const [, day, month, year, hour, minute, second] = match
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ),
    )
  }

  const [, , , , , , , year, month, day, hour, minute, second] = match
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  )
}

export function parseSmartbillRateLimit(
  status: number,
  parsed: unknown,
  now: Date,
): ParsedSmartbillRateLimit | null {
  if (!isRecord(parsed)) return null

  const errorText =
    typeof parsed.errorText === "string"
      ? parsed.errorText
      : typeof parsed.message === "string"
        ? parsed.message
        : ""
  if (status !== 403 && !RATE_LIMIT_TEXT_PATTERN.test(errorText)) return null
  if (!RATE_LIMIT_TEXT_PATTERN.test(errorText)) return null

  const minutesMatch = RATE_LIMIT_MINUTES_PATTERN.exec(errorText)
  const blockedAt = parseSmartbillDate(errorText)
  const minutes = minutesMatch?.[1] ? Number(minutesMatch[1]) : undefined
  const retryAfterAt =
    blockedAt && minutes !== undefined
      ? new Date(blockedAt.getTime() + minutes * 60_000)
      : typeof parsed.cooldown === "number" && parsed.cooldown > 0
        ? new Date(now.getTime() + parsed.cooldown * 1000)
        : undefined
  const retryAfterMs = retryAfterAt
    ? Math.max(0, retryAfterAt.getTime() - now.getTime())
    : undefined

  return {
    errorText,
    retryAfterMs,
    retryAfterAt,
    blockedAt,
  }
}
