const ADMIN_API_PREFIXES = [
  "/v1/relationships",
  "/v1/operations",
  "/v1/products",
  "/v1/markets",
  "/v1/bookings",
  "/v1/suppliers",
] as const

function rewriteAdminPath(pathname: string): string {
  const apiPrefix = "/api"
  const hasApiPrefix = pathname === apiPrefix || pathname.startsWith(`${apiPrefix}/`)
  const appPath = hasApiPrefix ? pathname.slice(apiPrefix.length) || "/" : pathname

  for (const prefix of ADMIN_API_PREFIXES) {
    if (appPath === prefix || appPath.startsWith(`${prefix}/`)) {
      const rewritten = appPath.replace(prefix, `/v1/admin${prefix.slice("/v1".length)}`)
      return hasApiPrefix ? `${apiPrefix}${rewritten}` : rewritten
    }
  }

  return pathname
}

export function normalizeOperatorAdminApiUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const parsed = new URL(url)
    parsed.pathname = rewriteAdminPath(parsed.pathname)
    return parsed.toString()
  }

  if (url.startsWith("/")) {
    const parsed = new URL(url, "http://voyant.local")
    const rewrittenPath = rewriteAdminPath(parsed.pathname)
    return `${rewrittenPath}${parsed.search}${parsed.hash}`
  }

  return url
}
