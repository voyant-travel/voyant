import type { Duration, ScheduleDeclaration } from "@voyantjs/workflows"

export function computeNextFire(decl: ScheduleDeclaration, fromMs: number): number {
  if ("cron" in decl) return nextCronFire(parseCron(decl.cron), fromMs)
  if ("every" in decl) return fromMs + toMs(decl.every)
  if ("at" in decl) {
    const at = typeof decl.at === "string" ? Date.parse(decl.at) : decl.at.getTime()
    if (!Number.isFinite(at)) throw new Error(`invalid "at" value: ${String(decl.at)}`)
    return at < fromMs ? Number.POSITIVE_INFINITY : at
  }
  throw new Error(`schedule declaration missing one of cron/every/at`)
}

export interface CronSpec {
  minute: number[]
  hour: number[]
  day: number[]
  month: number[]
  dow: number[]
}

export function parseCron(expr: string): CronSpec {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(`invalid cron "${expr}" - expected 5 fields (minute hour day month dow)`)
  }
  return {
    minute: parseField(parts[0]!, 0, 59, "minute"),
    hour: parseField(parts[1]!, 0, 23, "hour"),
    day: parseField(parts[2]!, 1, 31, "day"),
    month: parseField(parts[3]!, 1, 12, "month"),
    dow: parseField(parts[4]!, 0, 6, "dow"),
  }
}

function parseField(f: string, min: number, max: number, label: string): number[] {
  const out = new Set<number>()
  for (const part of f.split(",")) {
    const stepMatch = /^(.+)\/(\d+)$/.exec(part)
    const body = stepMatch ? stepMatch[1]! : part
    const step = stepMatch ? Number(stepMatch[2]) : 1
    if (!(step >= 1)) throw new Error(`cron ${label} step must be >=1 in "${f}"`)
    let lo: number
    let hi: number
    if (body === "*") {
      lo = min
      hi = max
    } else if (body.includes("-")) {
      const [a, b] = body.split("-")
      lo = Number(a)
      hi = Number(b)
    } else {
      lo = Number(body)
      hi = lo
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < min || hi > max || lo > hi) {
      throw new Error(`cron ${label} out of range [${min}..${max}] in "${f}"`)
    }
    for (let i = lo; i <= hi; i += step) out.add(i)
  }
  return [...out].sort((a, b) => a - b)
}

export function nextCronFire(spec: CronSpec, fromMs: number): number {
  const date = new Date(fromMs)
  date.setUTCSeconds(0, 0)
  date.setUTCMinutes(date.getUTCMinutes() + 1)

  const maxIterations = 60 * 24 * 366 * 5
  for (let i = 0; i < maxIterations; i++) {
    if (
      spec.minute.includes(date.getUTCMinutes()) &&
      spec.hour.includes(date.getUTCHours()) &&
      spec.day.includes(date.getUTCDate()) &&
      spec.month.includes(date.getUTCMonth() + 1) &&
      spec.dow.includes(date.getUTCDay())
    ) {
      return date.getTime()
    }
    date.setUTCMinutes(date.getUTCMinutes() + 1)
  }
  throw new Error("cron search exceeded 5 years without finding a match")
}

export function toMs(duration: Duration): number {
  if (typeof duration === "number") return duration
  const m = /^(\d+)(ms|s|m|h|d|w)$/.exec(duration)
  if (!m) throw new Error(`invalid duration "${duration}"`)
  const n = Number(m[1])
  switch (m[2]) {
    case "ms":
      return n
    case "s":
      return n * 1_000
    case "m":
      return n * 60_000
    case "h":
      return n * 3_600_000
    case "d":
      return n * 86_400_000
    case "w":
      return n * 604_800_000
    default:
      throw new Error(`invalid duration "${duration}"`)
  }
}
