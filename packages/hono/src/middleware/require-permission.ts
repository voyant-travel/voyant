import type { Actor, VoyantPermission } from "@voyantjs/core"
import { hasApiKeyPermission, permissionStringsToPermissions } from "@voyantjs/types/api-keys"
import type { MiddlewareHandler } from "hono"

import { requireUserId } from "../auth/require-user.js"
import {
  type DbFactory,
  isDisposableDb,
  type VoyantAuthIntegration,
  type VoyantBindings,
  type VoyantDb,
  type VoyantVariables,
} from "../types.js"

/** See db middleware: structural shape avoids a hard `@cloudflare/workers-types` dep. */
interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void
}

import { ForbiddenApiError, UnauthorizedApiError } from "../validation.js"

export function requirePermission<TBindings extends VoyantBindings>(
  dbFactory: DbFactory<TBindings>,
  resource: string,
  action: string,
  opts?: {
    auth?: VoyantAuthIntegration<TBindings>
  },
): MiddlewareHandler<{
  Bindings: TBindings
  Variables: VoyantVariables
}> {
  return async (c, next) => {
    const permission: VoyantPermission = { resource, action }

    if (c.get("isInternalRequest")) {
      return next()
    }

    const scopes = c.get("scopes")
    if (
      scopes &&
      hasApiKeyPermission(
        permissionStringsToPermissions(scopes),
        permission.resource,
        permission.action,
      )
    ) {
      return next()
    }

    const userId = requireUserId(c)
    const actor = c.get("actor") as Actor | undefined
    if (!actor) {
      // Should be unreachable in well-wired apps: `requireActor` runs before
      // `requirePermission`. Throw rather than fabricate a default so callers
      // see the upstream wiring bug instead of a silent privilege grant.
      throw new UnauthorizedApiError()
    }

    if (!opts?.auth?.hasPermission) {
      return c.json({ error: "No auth permission checker configured" }, 500)
    }

    const factoryResult = dbFactory(c.env)
    const db: VoyantDb = isDisposableDb(factoryResult) ? factoryResult.db : factoryResult
    const dispose = isDisposableDb(factoryResult) ? factoryResult.dispose : undefined

    try {
      const allowed = await opts.auth.hasPermission({
        request: c.req.raw,
        env: c.env,
        db,
        ctx: c.executionCtx,
        auth: {
          userId,
          actor,
          sessionId: c.get("sessionId"),
          organizationId: c.get("organizationId"),
          callerType: c.get("callerType"),
          scopes,
          isInternalRequest: c.get("isInternalRequest"),
          apiTokenId: c.get("apiTokenId"),
          apiKeyId: c.get("apiKeyId"),
        },
        permission,
      })

      if (!allowed) {
        throw new ForbiddenApiError()
      }

      return next()
    } finally {
      if (dispose) {
        const ctx = c.executionCtx as ExecutionContextLike | undefined
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(dispose())
        } else {
          await dispose()
        }
      }
    }
  }
}
