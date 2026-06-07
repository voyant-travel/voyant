export interface SlotLocalDateTime {
  date: string
  time: string
}

export interface SlotTimeRangeInput {
  startsAt: string | Date
  endsAt?: string | Date | null
  timezone: string
}

export interface LocalToInstantInput {
  date: string
  time: string
  timezone: string
}

interface DateTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

function getFormatter(timezone: string) {
  let formatter = dateTimeFormatters.get(timezone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    dateTimeFormatters.set(timezone, formatter)
  }
  return formatter
}

function toInstant(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid instant: ${String(value)}`)
  }
  return date
}

function readParts(value: string | Date, timezone: string): DateTimeParts {
  const parts = getFormatter(timezone).formatToParts(toInstant(value))
  const byType = new Map(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(byType.get("year")),
    month: Number(byType.get("month")),
    day: Number(byType.get("day")),
    hour: Number(byType.get("hour")),
    minute: Number(byType.get("minute")),
    second: Number(byType.get("second")),
  }
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

function partsToLocal(parts: DateTimeParts): SlotLocalDateTime {
  return {
    date: `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`,
    time: `${pad2(parts.hour)}:${pad2(parts.minute)}`,
  }
}

function parseLocalInput(input: LocalToInstantInput): DateTimeParts {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date)
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input.time)
  if (!dateMatch || !timeMatch) {
    throw new RangeError("Local date/time must use YYYY-MM-DD and HH:mm or HH:mm:ss")
  }

  const parts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? "0"),
  }

  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 59
  ) {
    throw new RangeError("Local date/time is out of range")
  }

  return parts
}

function partsToUtcMillis(parts: DateTimeParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

function sameLocalParts(left: DateTimeParts, right: DateTimeParts) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  )
}

export function instantToSlotLocal(instant: string | Date, timezone: string): SlotLocalDateTime {
  return partsToLocal(readParts(instant, timezone))
}

export function slotLocalStart(slot: SlotTimeRangeInput): SlotLocalDateTime {
  return instantToSlotLocal(slot.startsAt, slot.timezone)
}

export function slotLocalEnd(slot: SlotTimeRangeInput): SlotLocalDateTime | null {
  return slot.endsAt ? instantToSlotLocal(slot.endsAt, slot.timezone) : null
}

export function slotEndDateLocal(slot: SlotTimeRangeInput): string | null {
  return slotLocalEnd(slot)?.date ?? null
}

export function localToInstant(input: LocalToInstantInput): string {
  const target = parseLocalInput(input)
  const targetMs = partsToUtcMillis(target)
  let candidateMs = targetMs

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = readParts(new Date(candidateMs), input.timezone)
    const actualMs = partsToUtcMillis(actual)
    const diff = actualMs - targetMs
    if (diff === 0) break
    candidateMs -= diff
  }

  const resolved = readParts(new Date(candidateMs), input.timezone)
  if (!sameLocalParts(resolved, target)) {
    throw new RangeError(
      `Local date/time ${input.date} ${input.time} does not exist in ${input.timezone}`,
    )
  }

  return new Date(candidateMs).toISOString()
}
