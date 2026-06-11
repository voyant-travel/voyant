import type { MiddlewareHandler } from "hono"

import type { VoyantBindings } from "../types.js"

function parseAllowlist(env: VoyantBindings): string[] {
  const raw = env.CORS_ALLOWLIST
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  } catch {
    return false
  }
}

function matchesPattern(origin: string, pattern: string): boolean {
  if (pattern === origin) return true
  if (!pattern.includes("*")) return false
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  return new RegExp(`^${escaped}$`).test(origin)
}

function isAllowedOrigin(origin: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return false
  const hasLocalhostEntry = allowlist.some((p) => isLocalhostOrigin(p) || p.includes("localhost"))
  if (hasLocalhostEntry && isLocalhostOrigin(origin)) return true
  return allowlist.some((p) => matchesPattern(origin, p))
}

export function cors(): MiddlewareHandler<{ Bindings: VoyantBindings }> {
  return async (c, next) => {
    const origin = c.req.header("origin") || ""
    const allowlist = parseAllowlist(c.env)
    const allowed = isAllowedOrigin(origin, allowlist)

    if (origin && !allowed) {
      console.warn("[CORS] Origin not in allowlist - CORS headers will NOT be set", {
        origin,
        allowlist,
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
