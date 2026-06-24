export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`
  }
  return `${process.env.DASH_BASE_URL ?? "http://localhost:3310"}/api`
}
