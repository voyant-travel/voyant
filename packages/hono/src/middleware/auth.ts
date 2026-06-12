import type { VoyantAuthContext } from "@voyantjs/core"
import { apikeyTable } from "@voyantjs/db/schema/iam"
import { permissionsToStrings } from "@voyantjs/types/api-keys"
import { and, eq } from "drizzle-orm"
import type { MiddlewareHandler } from "hono"

import { sha256Base64Url } from "../auth/crypto.js"
import { extractBearerToken, verifySession } from "../auth/session-jwt.js"
import { tryGetExecutionCtx } from "../lib/execution-ctx.js"
import type { DbFactory, VoyantAuthIntegration, VoyantBindings, VoyantVariables } from "../types.js"
import { acquireRequestDb } from "./request-db.js"

const API_KEY_PREFIX = "voy_"

function applyAuthContext(
  c: {
    set: <K extends keyof VoyantVariables>(key: K, value: VoyantVariables[K]) => void
  },
  auth: VoyantAuthContext,
) {
  if (auth.userId) c.set("userId", auth.userId)
  if (auth.sessionId) c.set("sessionId", auth.sessionId)
  if (auth.organizationId !== undefined) c.set("organizationId", auth.organizationId ?? undefined)
  if (auth.callerType) c.set("callerType", auth.callerType)
  if (auth.actor) c.set("actor", auth.actor)
  if (auth.scopes !== undefined) c.set("scopes", auth.scopes)
  if (auth.isInternalRequest !== undefined) c.set("isInternalRequest", auth.isInternalRequest)
  if (auth.apiTokenId) c.set("apiTokenId", auth.apiTokenId)
  if (auth.apiKeyId) c.set("apiKeyId", auth.apiKeyId)
}

export function requireAuth<TBindings extends VoyantBindings>(
  dbFactory: DbFactory<TBindings>,
  opts?: {
    publicPaths?: string[]
    auth?: VoyantAuthIntegration<TBindings>
  },
): MiddlewareHandler<{
  Bindings: TBindings
  Variables: VoyantVariables
}> {
  const publicPaths = opts?.publicPaths ?? []

  return async (c, next) => {
    if (c.req.method === "OPTIONS") return next()

    const url = new URL(c.req.url)
    const p = url.pathname.replace(/\/$/, "")
    const isPublicAuth = p === "/auth/callback" || p.startsWith("/auth/")
    const isHealthCheck = p === "/health"

    if (isPublicAuth || isHealthCheck) return next()

    for (const pp of publicPaths) {
      if (p === pp || p.startsWith(`${pp}/`)) {
        if (p.startsWith("/v1/public/")) {
          c.set("actor", "customer")
        }
        return next()
      }
    }

    const authHeader = c.req.header("authorization") || c.req.header("Authorization")
    const token = extractBearerToken(authHeader)

    // Strategy 1: Internal API Key
    const internalKey = c.env.INTERNAL_API_KEY
    if (token && internalKey && token === internalKey) {
      applyAuthContext(c, {
        callerType: "internal",
        isInternalRequest: true,
      })
      return next()
    }

    // Strategy 2: Core-owned API key support (voy_ prefixed)
    if (token?.startsWith(API_KEY_PREFIX)) {
      // Shared per-request client — the db middleware downstream reuses
      // this same client instead of opening a second Pool.
      const lease = acquireRequestDb(c, dbFactory)
      const db = lease.db
      try {
        const keyHash = await sha256Base64Url(token)

        const [row] = await db
          .select()
          .from(apikeyTable)
          .where(and(eq(apikeyTable.key, keyHash), eq(apikeyTable.enabled, true)))
          .limit(1)

        if (!row) {
          return c.json({ error: "Invalid API key" }, 401)
        }

        if (row.expiresAt && row.expiresAt < new Date()) {
          return c.json({ error: "API key expired" }, 401)
        }

        if (row.remaining !== null && row.remaining <= 0) {
          return c.json({ error: "API key usage limit exceeded" }, 429)
        }

        if (opts?.auth?.validateApiKey) {
          const isValid = await opts.auth.validateApiKey({
            request: c.req.raw,
            env: c.env,
            db,
            // Guarded: Hono throws on `executionCtx` access outside Workers.
            ctx: tryGetExecutionCtx(c),
            apiKey: row,
          })

          if (!isValid) {
            return c.json({ error: "Invalid API key" }, 401)
          }
        }

        // Usage counters update off the response path. The query promise
        // starts immediately either way; `waitUntil` (when the runtime has
        // one) just keeps the isolate alive until it settles.
        const counterUpdate =
          row.remaining !== null
            ? db
                .update(apikeyTable)
                .set({
                  remaining: row.remaining - 1,
                  requestCount: row.requestCount + 1,
                  lastRequest: new Date(),
                })
                .where(eq(apikeyTable.id, row.id))
                .then(() => {})
                .catch(() => {})
            : db
                .update(apikeyTable)
                .set({
                  requestCount: row.requestCount + 1,
                  lastRequest: new Date(),
                })
                .where(eq(apikeyTable.id, row.id))
                .then(() => {})
                .catch(() => {})
        tryGetExecutionCtx(c)?.waitUntil(counterUpdate)

        const scopes = permissionsToStrings(row.permissions)

        applyAuthContext(c, {
          organizationId: row.referenceId,
          scopes,
          callerType: "api_key",
          apiTokenId: row.id,
          apiKeyId: row.id,
          // Core-owned API keys (`voy_` prefix) are server-to-server credentials
          // issued to operator staff. The actor stays explicit here so that
          // `requireActor` doesn't have to default unset callers to "staff".
          actor: "staff",
        })

        return next()
      } catch {
        // fall through to next strategy
      } finally {
        // Releases the lease AFTER downstream completes (we're past
        // `return next()` here). The creating lease schedules pool
        // teardown via waitUntil so the worker stays alive for the
        // close handshake; reuse leases are no-ops.
        await lease.release()
      }
    }

    // Strategy 3: App-provided auth resolution (cookies, provider tokens, etc.)
    if (opts?.auth?.resolve) {
      const lease = acquireRequestDb(c, dbFactory)
      try {
        const resolved = await opts.auth.resolve({
          request: c.req.raw,
          env: c.env,
          db: lease.db,
          // Guarded: Hono throws on `executionCtx` access outside Workers.
          ctx: tryGetExecutionCtx(c),
        })

        if (resolved?.userId) {
          applyAuthContext(c, resolved)
          return next()
        }
      } finally {
        await lease.release()
      }
    }

    // Strategy 4: Generic session-claims bearer token support
    const sessionSecret = c.env.SESSION_CLAIMS_SECRET

    if (token && sessionSecret && token.includes(".")) {
      try {
        const sessionAuth = await verifySession(token, sessionSecret)

        applyAuthContext(c, {
          ...sessionAuth,
          callerType: "session",
        })

        return next()
      } catch {
        // fall through
      }
    }

    return c.json({ error: "Unauthorized" }, 401)
  }
}
