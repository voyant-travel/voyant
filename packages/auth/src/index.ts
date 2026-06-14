export type RouteContext = {
  siteId?: string
  organizationType?: "live" | "sandbox" | null
}

export function isStaticPath(pathname: string) {
  return pathname.startsWith("/_next") || /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- owner: auth; existing suppression is intentional pending typed cleanup.
export function isApiPath(_pathname: string) {
  // API routes should be evaluated by middleware for auth context propagation.
  return false
}

export function isPublicPath(pathname: string) {
  return ["/login", "/auth", "/sign-in", "/sign-up", "/forgot-password", "/reset-password"].some(
    (p) => pathname.startsWith(p),
  )
}

export function attachOrganizationHeaders(headers: Headers, ctx: RouteContext) {
  if (ctx.siteId) headers.set("x-site-id", String(ctx.siteId))
  if (ctx.organizationType) headers.set("x-organization-type", ctx.organizationType)
}

export type VoyantSubdomain = {
  type: "booking" | "customer"
  slug: string
  isLocal: boolean
}

export function parseVoyantSubdomain(hostname: string): VoyantSubdomain | null {
  const normalized = hostname.toLowerCase().split(":")[0] ?? ""

  const prodMatch = normalized.match(
    /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.(booking|customer)\.voyantcloud\.app$/,
  )
  if (prodMatch?.[1] && prodMatch[2]) {
    const slug = prodMatch[1]
    const type = prodMatch[2] as "booking" | "customer"
    if (slug.includes("--")) return null
    return { type, slug, isLocal: false }
  }

  const localMatch = normalized.match(
    /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.(booking|customer)\.localhost$/,
  )
  if (localMatch?.[1] && localMatch[2]) {
    const slug = localMatch[1]
    const type = localMatch[2] as "booking" | "customer"
    if (slug.includes("--")) return null
    return { type, slug, isLocal: true }
  }

  return null
}

// NOTE: Do NOT re-export from ./server here.
// Those modules import better-auth which uses dynamic code evaluation
// (eval/new Function) incompatible with Edge Runtime middleware.
// Import it directly: @voyant-travel/auth/server
