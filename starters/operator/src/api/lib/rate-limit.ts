type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: max - 1, resetAt }
  }
  if (b.count >= max) {
    return { allowed: false, remaining: 0, resetAt: b.resetAt }
  }
  b.count += 1
  return { allowed: true, remaining: Math.max(0, max - b.count), resetAt: b.resetAt }
}

export function ipFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for") || ""
  const ip = xff.split(",")[0]?.trim() || headers.get("x-real-ip") || "ip:unknown"
  return String(ip)
}
