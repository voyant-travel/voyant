import type { MiddlewareHandler } from "hono"

import type { VoyantBindings } from "../types.js"

const DEFAULT_CSP =
  "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; " +
  "img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; " +
  "connect-src 'self'"

export interface SecurityHeadersOptions {
  contentSecurityPolicy?: string | false
  hsts?: boolean
}

export function securityHeaders(
  options: SecurityHeadersOptions = {},
): MiddlewareHandler<{ Bindings: VoyantBindings }> {
  const csp =
    options.contentSecurityPolicy === undefined ? DEFAULT_CSP : options.contentSecurityPolicy
  const hsts = options.hsts ?? true

  return async (c, next) => {
    await next()

    c.header("X-Content-Type-Options", "nosniff")
    c.header("Referrer-Policy", "strict-origin-when-cross-origin")
    c.header("X-Frame-Options", "DENY")
    c.header("Cross-Origin-Opener-Policy", "same-origin")
    if (csp) c.header("Content-Security-Policy", csp)
    if (hsts && new URL(c.req.url).protocol === "https:") {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    }
  }
}
