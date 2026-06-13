export function getTrustedOrigins(): string[] {
  const values = [
    process.env.BETTER_AUTH_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VOYANT_DASHBOARD_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.ADMIN_URL,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0)

  return Array.from(new Set(values.map((value) => value.trim().replace(/\/$/, ""))))
}

const LOCAL_WILDCARDS = [
  "http://localhost:*",
  "http://127.0.0.1:*",
  "https://localhost:*",
  "https://127.0.0.1:*",
]

function hasLocalOrigin(origins: string[], baseURL: string): boolean {
  const all = [...origins, baseURL]
  return all.some((value) => {
    try {
      const { hostname } = new URL(value)
      return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
    } catch {
      return false
    }
  })
}

/**
 * If the app is running against a localhost baseURL (dev), allow any localhost
 * origin/port so second dev servers (e.g. Vite on :3301 hitting API on :3200)
 * aren't rejected by Better Auth's origin check. Production origins are
 * unaffected - the wildcards are only added when we already see localhost.
 */
export function expandTrustedOrigins(origins: string[], baseURL: string): string[] {
  if (!hasLocalOrigin(origins, baseURL)) return origins
  return Array.from(new Set([...origins, ...LOCAL_WILDCARDS]))
}
