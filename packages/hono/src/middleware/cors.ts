import type { MiddlewareHandler } from "hono"

import type { VoyantBindings } from "../types.js"

interface CompiledAllowlist {
  entries: string[]
  /** Pre-compiled matcher per entry — equality check or wildcard RegExp. */
  matchers: Array<(origin: string) => boolean>
  hasLocalhostEntry: boolean
}

/**
 * Parsed allowlists keyed by the raw `CORS_ALLOWLIST` value. The env value
 * is constant per deployment (at most a handful of distinct values per
 * isolate across preview/production bindings), so the cache stays tiny —
 * but it saves a split + trim + wildcard RegExp compilation on every
 * request.
 */
const compiledAllowlists = new Map<string, CompiledAllowlist>()

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  } catch {
    return false
  }
}

function compileMatcher(pattern: string): (origin: string) => boolean {
  if (!pattern.includes("*")) {
    return (origin) => origin === pattern
  }
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  const regex = new RegExp(`^${escaped}$`)
  return (origin) => regex.test(origin)
}

function compileAllowlist(raw: string | undefined): CompiledAllowlist {
  const key = raw ?? ""
  const cached = compiledAllowlists.get(key)
  if (cached) return cached

  const entries = key
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const compiled: CompiledAllowlist = {
    entries,
    matchers: entries.map(compileMatcher),
    hasLocalhostEntry: entries.some((p) => isLocalhostOrigin(p) || p.includes("localhost")),
  }
  compiledAllowlists.set(key, compiled)
  return compiled
}

function isAllowedOrigin(origin: string, allowlist: CompiledAllowlist): boolean {
  if (allowlist.entries.length === 0) return false
  if (allowlist.hasLocalhostEntry && isLocalhostOrigin(origin)) return true
  return allowlist.matchers.some((matches) => matches(origin))
}

export function cors(): MiddlewareHandler<{ Bindings: VoyantBindings }> {
  return async (c, next) => {
    const origin = c.req.header("origin") || ""
    const allowlist = compileAllowlist(c.env.CORS_ALLOWLIST)
    const allowed = isAllowedOrigin(origin, allowlist)

    if (origin && !allowed) {
      console.warn("[CORS] Origin not in allowlist - CORS headers will NOT be set", {
        origin,
        allowlist: allowlist.entries,
        path: c.req.path,
        method: c.req.method,
      })
    }

    if (c.req.method === "OPTIONS") {
      if (allowed) {
        c.header("Access-Control-Allow-Origin", origin)
        c.header("Vary", "Origin")
        c.header("Access-Control-Allow-Credentials", "true")
        c.header(
          "Access-Control-Allow-Headers",
          c.req.header("access-control-request-headers") || "content-type, authorization",
        )
        c.header(
          "Access-Control-Allow-Methods",
          c.req.header("access-control-request-method") || "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        )
      }
      return c.body(null, 204)
    }

    await next()

    if (allowed) {
      c.header("Access-Control-Allow-Origin", origin)
      c.header("Vary", "Origin")
      c.header("Access-Control-Allow-Credentials", "true")
    }
  }
}
