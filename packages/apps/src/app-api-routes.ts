import type { VoyantAppContextConstraint } from "@voyant-travel/core"
import {
  ApiHttpError,
  parseJsonBody,
  parseQuery,
  RequestValidationError,
} from "@voyant-travel/hono"
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
  appApiFinanceExternalLifecycleStateSchema,
  appApiFinanceExternalReferenceUpsertSchema,
  appApiFinanceExternalSyncStateSchema,
  appApiFinancePdfArtifactHeadersSchema,
  appApiFinanceSettlementObservationSchema,
  appApiVersionHeader,
  appApiWebhookReplaySchema,
  appApiWebhookSigningKeyConfirmSchema,
} from "./app-api-contracts.js"
import {
  type AppApiAccessContext,
  type AppApiServiceOptions,
  createAppApiService,
  withAppApiDeadline,
} from "./app-api-service.js"

type Env = {
  Bindings: {
    API_BASE_URL?: string
  }
  Variables: {
    db: PostgresJsDatabase
    appId?: string
    appInstallationId?: string
    appReleaseId?: string
    appTokenMode?: "offline" | "online"
    appViewerId?: string
    appContextConstraint?: VoyantAppContextConstraint
    callerType?: string
    scopes?: string[]
  }
}

/** Absolute mount prefix for the versioned App API surface. */
export const APP_API_BASE_PATH = "/v1/app"

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
  deadlineMs?: number
  maxPayloadBytes?: number
  maxFinanceArtifactBytes?: number
  /** Managed-host acknowledgement; absent for self-hosted runtimes. */
  completeMarketplaceSetup?: (context: AppApiAccessContext) => Promise<void>
}

export function createAppsAppApiRoutes(options: AppsAppApiRouteOptions = {}) {
  const routes = new Hono<Env>()
  const service = createAppApiService(options)
  const completeMarketplaceSetup = options.completeMarketplaceSetup
  const maxPayloadBytes = options.maxPayloadBytes ?? 256 * 1024
  const maxFinanceArtifactBytes = options.maxFinanceArtifactBytes ?? 10 * 1024 * 1024

  routes.use("*", async (c, next) => {
    if (c.get("callerType") !== "app") {
      throw new ApiHttpError("App API requires an app access token.", {
        status: 401,
        code: "app_api_token_required",
      })
    }
    const requestLimit = isFinancePdfArtifactRequest(c) ? maxFinanceArtifactBytes : maxPayloadBytes
    const declaredLength = c.req.header("content-length")
    if (declaredLength !== undefined && !/^(0|[1-9][0-9]*)$/.test(declaredLength)) {
      throw new ApiHttpError("App API Content-Length is invalid.", {
        status: 400,
        code: "app_api_content_length_invalid",
      })
    }
    const length = Number(declaredLength ?? "0")
    if (!Number.isSafeInteger(length)) {
      throw new ApiHttpError("App API Content-Length is invalid.", {
        status: 400,
        code: "app_api_content_length_invalid",
      })
    }
    if (length > requestLimit) {
      throw new ApiHttpError("App API payload is too large.", {
        status: 413,
        code: "app_api_payload_too_large",
        details: { maxPayloadBytes: requestLimit },
      })
    }
    return next()
  })

  routes.get("/self", (c) =>
    run(c, service.introspect(c.get("db"), appContext(c)), options.deadlineMs),
  )

  if (completeMarketplaceSetup) {
    routes.post("/marketplace/setup-completion", async (c) => {
      // The verified OAuth App API context is the sole identity input. This
      // operation intentionally has no request schema/body and no tenant-
      // supplied Cloud credential.
      if (await hasRequestBodyBytes(c)) {
        throw new ApiHttpError("Marketplace setup completion does not accept a request body.", {
          status: 400,
          code: "app_api_setup_completion_body_not_allowed",
        })
      }
      const context = appContext(c)
      await withAppApiDeadline(completeMarketplaceSetup(context), options.deadlineMs)
      c.header("cache-control", "no-store")
      return c.json({ data: { acknowledged: true as const } }, 200)
    })
  }

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

  routes.get("/finance/documents/:id", (c) => {
    const { id } = parseIdParams(c.req.param())
    return run(
      c,
      service.getFinanceIssuanceDocument(c.get("db"), appContext(c), id),
      options.deadlineMs,
    )
  })

  routes.get("/finance/documents/:id/external-reference", (c) => {
    const { id } = parseIdParams(c.req.param())
    return run(
      c,
      service.getFinanceExternalReference(c.get("db"), appContext(c), id),
      options.deadlineMs,
    )
  })

  routes.put("/finance/documents/:id/external-reference", async (c) => {
    const { id } = parseIdParams(c.req.param())
    const body = await parseJsonBody(c, appApiFinanceExternalReferenceUpsertSchema)
    return run(
      c,
      service.upsertFinanceExternalReference(c.get("db"), appContext(c), id, body),
      options.deadlineMs,
    )
  })

  routes.put("/finance/documents/:id/artifacts/provider-pdf", async (c) => {
    const { id } = parseIdParams(c.req.param())
    if (c.req.header("content-type")?.toLowerCase() !== "application/pdf") {
      throw new ApiHttpError("Finance document artifact must be an application/pdf body.", {
        status: 415,
        code: "app_api_finance_artifact_media_type_unsupported",
      })
    }
    const headers = parseArtifactHeaders(c)
    const bytes = await readBoundedArtifactBody(c, maxFinanceArtifactBytes)
    if (!hasPdfSignature(bytes)) {
      throw new ApiHttpError("Finance document artifact is not a PDF.", {
        status: 415,
        code: "app_api_finance_artifact_invalid_pdf",
      })
    }
    const result = await withAppApiDeadline(
      service.attachFinancePdfArtifact(c.get("db"), appContext(c), id, c.env, headers, bytes),
      options.deadlineMs,
    )
    return c.json({
      data: {
        outcome: result.data.outcome,
        artifact: {
          id: result.data.artifact.id,
          documentId: result.data.artifact.documentId,
          provider: result.data.artifact.provider,
          fileName: result.data.artifact.fileName,
          byteSize: result.data.artifact.byteSize,
          checksum: result.data.artifact.checksum,
          createdAt: result.data.artifact.createdAt,
          documentUrl: financeArtifactDocumentUrl(c, result.data.artifact.id),
        },
      },
    })
  })

  routes.put("/finance/documents/:id/external-sync-state", async (c) => {
    const { id } = parseIdParams(c.req.param())
    const body = await parseJsonBody(c, appApiFinanceExternalSyncStateSchema)
    return run(
      c,
      service.updateFinanceExternalSyncState(c.get("db"), appContext(c), id, body),
      options.deadlineMs,
    )
  })

  routes.put("/finance/documents/:id/external-lifecycle-state", async (c) => {
    const { id } = parseIdParams(c.req.param())
    const body = await parseJsonBody(c, appApiFinanceExternalLifecycleStateSchema)
    return run(
      c,
      service.updateFinanceExternalLifecycleState(c.get("db"), appContext(c), id, body),
      options.deadlineMs,
    )
  })

  routes.post("/finance/documents/:id/settlement-observations", async (c) => {
    const { id } = parseIdParams(c.req.param())
    const body = await parseJsonBody(c, appApiFinanceSettlementObservationSchema)
    return run(
      c,
      service.recordFinanceSettlementObservation(c.get("db"), appContext(c), id, body),
      options.deadlineMs,
      201,
    )
  })

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

  routes.post("/webhooks/signing-key/issue", (c) => {
    c.header("Cache-Control", "no-store")
    return run(c, service.issueWebhookSigningKey(c.get("db"), appContext(c)), options.deadlineMs)
  })

  routes.post("/webhooks/signing-key/confirm", async (c) => {
    c.header("Cache-Control", "no-store")
    const body = await parseJsonBody(c, appApiWebhookSigningKeyConfirmSchema)
    return run(
      c,
      service.confirmWebhookSigningKey(c.get("db"), appContext(c), body),
      options.deadlineMs,
    )
  })

  routes.post("/webhooks/replay", async (c) => {
    const body = await parseJsonBody(c, appApiWebhookReplaySchema)
    return run(
      c,
      service.replayWebhookDelivery(c.get("db"), appContext(c), body.deliveryId),
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

  // Lazy route families forward the original absolute URL, so the loaded
  // sub-app must expose absolute paths. Mount the relative handlers under the
  // App API prefix; the matchers in api-runtime install `/v1/app` and
  // `/v1/app/*` up front.
  const app = new Hono<Env>()
  app.route(APP_API_BASE_PATH, routes)
  return app
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
    contextConstraint: c.get("appContextConstraint"),
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

function parseArtifactHeaders(c: Context<Env>) {
  const parsed = appApiFinancePdfArtifactHeadersSchema.safeParse({
    idempotencyKey: c.req.header("idempotency-key"),
    fileName: c.req.header("x-voyant-artifact-name"),
  })
  if (!parsed.success) throw new RequestValidationError("Invalid artifact request headers")
  return parsed.data
}

function isFinancePdfArtifactRequest(c: Context<Env>) {
  return (
    c.req.method === "PUT" &&
    /^\/v1\/app\/finance\/documents\/[^/]+\/artifacts\/provider-pdf$/.test(c.req.path)
  )
}

async function hasRequestBodyBytes(c: Context<Env>) {
  const declaredLength = c.req.header("content-length")
  if (declaredLength === "0") return false
  if (declaredLength !== undefined) return true

  const body = c.req.raw.body
  if (!body) return false

  const reader = body.getReader()
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) return false
      if (next.value.byteLength > 0) {
        await reader.cancel("Marketplace setup completion does not accept a request body.")
        return true
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function hasPdfSignature(bytes: Uint8Array) {
  return (
    bytes.byteLength >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
}

async function readBoundedArtifactBody(c: Context<Env>, maxBytes: number) {
  const body = c.req.raw.body
  if (!body) return new Uint8Array()
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > maxBytes) {
        await reader.cancel("Finance document artifact exceeded limit")
        throw new ApiHttpError("Finance document artifact is too large.", {
          status: 413,
          code: "app_api_payload_too_large",
          details: { maxPayloadBytes: maxBytes },
        })
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function financeArtifactDocumentUrl(c: Context<Env>, artifactId: string) {
  const path = `/v1/admin/finance/invoice-renditions/${encodeURIComponent(artifactId)}/download`
  const configuredApiBaseUrl = c.env.API_BASE_URL?.trim().replace(/\/+$/, "")
  return configuredApiBaseUrl
    ? `${configuredApiBaseUrl}${path}`
    : new URL(path, c.req.url).toString()
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
