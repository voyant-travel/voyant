export function generateLocalRunId(
  now: () => number = () => Date.now(),
  random: () => number = Math.random,
): string {
  const ts = now().toString(36)
  const rand = Math.floor(random() * 1_000_000)
    .toString(36)
    .padStart(4, "0")
  return `run_${ts}_${rand}`
}

export function durationToMs(d: unknown): number | undefined {
  if (d === undefined || d === null) return undefined
  if (typeof d === "number") return d
  if (typeof d !== "string") return undefined
  const m = /^(\d+)(ms|s|m|h|d|w)$/.exec(d)
  if (!m) return undefined
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
      return undefined
  }
}
