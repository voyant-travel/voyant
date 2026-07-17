import {
  ApiHttpError,
  parseJsonBody,
  parseQuery,
  RequestValidationError,
} from "@voyant-travel/hono"
import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"
import { z } from "zod"
import {
  appApiAuditQuerySchema,
  appApiCustomFieldDefinitionCreateSchema,
  appApiCustomFieldDefinitionListQuerySchema,
  appApiCustomFieldDefinitionUpdateSchema,
  appApiCustomFieldValueListQuerySchema,
  appApiCustomFieldValueUpsertSchema,
  appApiEntityReadQuerySchema,
  appApiFinanceActionSchema,
  appApiFinanceDocumentQuerySchema,
  appApiTokenExchangeSchema,
  appApiVersionHeader,
  appApiWebhookReplaySchema,
} from "./app-api-contracts.js"
import {
  type AppApiAccessContext,
  type AppApiServiceOptions,
  createAppApiService,
  withAppApiDeadline,
} from "./app-api-service.js"
import { createAppOAuthService } from "./oauth-service.js"
import { replayAppWebhookDelivery } from "./webhook-delivery.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    appId?: string
    appInstallationId?: string
    appReleaseId?: string
    appTokenMode?: "offline" | "online"
    appViewerId?: string
    callerType?: string
    scopes?: string[]
  }
}

const idParamSchema = z.object({ id: z.string().min(1) })
const entityParamSchema = z.object({ entity: z.string().min(1) })
const definitionBodySchema = z
  .object({
    namespace: z.string().optional(),
    definition: appApiCustomFieldDefinitionCreateSchema,
  })
  .strict()
const definitionUpdateBodySchema = z
  .object({
    namespace: z.string().optional(),
    definition: appApiCustomFieldDefinitionUpdateSchema,
  })
  .strict()

export interface AppsAppApiRouteOptions extends AppApiServiceOptions {
  oauth?: {
    accessCatalog: AccessCatalog
    deploymentId: string
  }
  deadlineMs?: number
  maxPayloadBytes?: number
}

export function createAppsAppApiRoutes(options: AppsAppApiRouteOptions = {}) {
  const routes = new Hono<Env>()
  const service = createAppApiService(options)
  const oauth = options.oauth ? createAppOAuthService(options.oauth) : null
  const maxPayloadBytes = options.maxPayloadBytes ?? 256 * 1024

  routes.use("*", async (c, next) => {
    if (c.get("callerType") !== "app") {
      throw new ApiHttpError("App API requires an app access token.", {
        status: 401,
        code: "app_api_token_required",
      })
    }
    const length = Number(c.req.header("content-length") ?? "0")
    if (Number.isFinite(length) && length > maxPayloadBytes) {
      throw new ApiHttpError("App API payload is too large.", {
        status: 413,
        code: "app_api_payload_too_large",
        details: { maxPayloadBytes },
      })
    }
    return next()
  })

  routes.get("/self", (c) =>
    run(c, service.introspect(c.get("db"), appContext(c)), options.deadlineMs),
  )

  routes.get("/entities/:entity", (c) => {
    const { entity } = parseEntityParams(c.req.param())
    const query = parseQuery(c, appApiEntityReadQuerySchema)
    return run(
      c,
      service.listEntities(c.get("db"), appContext(c), entity, query),
      options.deadlineMs,
    )
  })

  routes.get("/finance/documents", (c) =>
    run(
      c,
      service.listFinanceDocuments(
        c.get("db"),
        appContext(c),
        parseQuery(c, appApiFinanceDocumentQuerySchema),
      ),
      options.deadlineMs,
    ),
  )

  routes.post("/finance/actions", async (c) => {
    const body = await parseJsonBody(c, appApiFinanceActionSchema)
    return run(
      c,
      service.executeFinanceAction(c.get("db"), appContext(c), body),
      options.deadlineMs,
    )
  })

  routes.get("/custom-fields/definitions", (c) =>
    run(
      c,
      service.listCustomFieldDefinitions(
        c.get("db"),
        appContext(c),
        parseQuery(c, appApiCustomFieldDefinitionListQuerySchema),
      ),
      options.deadlineMs,
    ),
  )

  routes.post("/custom-fields/definitions", async (c) => {
    const body = await parseJsonBody(c, definitionBodySchema)
    return run(
      c,
      service.createCustomFieldDefinition(
        c.get("db"),
        appContext(c),
        body.namespace,
        body.definition,
      ),
      options.deadlineMs,
    )
  })

  routes.patch("/custom-fields/definitions/:id", async (c) => {
    const { id } = parseIdParams(c.req.param())
    const body = await parseJsonBody(c, definitionUpdateBodySchema)
    return run(
      c,
      service.updateCustomFieldDefinition(
        c.get("db"),
        appContext(c),
        id,
        body.namespace,
        body.definition,
      ),
      options.deadlineMs,
    )
  })

  routes.get("/custom-fields/values", (c) =>
    run(
      c,
      service.listCustomFieldValues(
        c.get("db"),
        appContext(c),
        parseQuery(c, appApiCustomFieldValueListQuerySchema),
      ),
      options.deadlineMs,
    ),
  )

  routes.put("/custom-fields/definitions/:id/value", async (c) => {
    const { id } = parseIdParams(c.req.param())
    const body = await parseJsonBody(c, appApiCustomFieldValueUpsertSchema)
    return run(
      c,
      service.upsertCustomFieldValue(c.get("db"), appContext(c), id, body),
      options.deadlineMs,
    )
  })

  routes.get("/webhooks", (c) =>
    run(c, service.listWebhookHealth(c.get("db"), appContext(c)), options.deadlineMs),
  )

  routes.post("/webhooks/replay", async (c) => {
    await service.requireAccess(c.get("db"), appContext(c), ["webhooks:replay"])
    const body = await parseJsonBody(c, appApiWebhookReplaySchema)
    return run(
      c,
      replayAppWebhookDelivery(c.get("db"), {
        deliveryId: body.deliveryId,
        actorId: appContext(c).appId,
        signingKey: { id: body.signingKeyId, secret: body.signingSecret },
      }),
      options.deadlineMs,
      202,
    )
  })

  routes.get("/audit", (c) =>
    run(
      c,
      service.listAuditHistory(c.get("db"), appContext(c), parseQuery(c, appApiAuditQuerySchema)),
      options.deadlineMs,
    ),
  )

  routes.post("/oauth/token-exchange", async (c) => {
    if (!oauth) return c.json({ error: "App OAuth is not configured" }, 501)
    const context = appContext(c)
    await service.requireAccess(c.get("db"), context, ["online-token:exchange"])
    const body = await parseJsonBody(c, appApiTokenExchangeSchema)
    return run(
      c,
      oauth.token(c.get("db"), {
        grantType: "urn:voyant:params:oauth:grant-type:actor-token-exchange",
        installationId: context.installationId,
        viewerId: body.viewer_id,
        viewerScopes: body.viewer_scopes,
        contextualScopes: body.contextual_scopes,
        clientId: body.client_id,
        clientSecret: body.client_secret,
      }),
      options.deadlineMs,
    )
  })

  return routes
}

function appContext(c: Context<Env>): AppApiAccessContext {
  const appId = c.get("appId")
  const installationId = c.get("appInstallationId")
  const releaseId = c.get("appReleaseId")
  const tokenMode = c.get("appTokenMode")
  if (!appId || !installationId || !releaseId || !tokenMode) {
    throw new RequestValidationError("App token context is missing.")
  }
  return {
    appId,
    installationId,
    releaseId,
    tokenMode,
    viewerId: c.get("appViewerId"),
    scopes: c.get("scopes") ?? [],
    apiVersion: c.req.header(appApiVersionHeader) ?? undefined,
  }
}

function parseIdParams(input: Record<string, string | undefined>) {
  const parsed = idParamSchema.safeParse(input)
  if (!parsed.success) throw new RequestValidationError("Invalid route parameters")
  return parsed.data
}

function parseEntityParams(input: Record<string, string | undefined>) {
  const parsed = entityParamSchema.safeParse(input)
  if (!parsed.success) throw new RequestValidationError("Invalid route parameters")
  return parsed.data
}

async function run<T>(
  c: Context<Env>,
  promise: Promise<T>,
  deadlineMs: number | undefined,
  status = 200,
) {
  const data = await withAppApiDeadline(promise, deadlineMs)
  return c.json(data, status as 200 | 202)
}
