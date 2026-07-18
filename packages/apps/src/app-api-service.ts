import type {
  CustomFieldValueLifecycleRuntime,
  CustomFieldValueOperationsRuntime,
} from "@voyant-travel/core/runtime-port"
import {
  type CustomFieldDefinitionOwner,
  createAppCustomFieldDefinitionOwner,
  createCustomFieldsService,
} from "@voyant-travel/custom-fields"
import { ApiHttpError } from "@voyant-travel/hono"
import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { assertActiveAppInstallationAccess } from "./access-boundary.js"
import type {
  AppApiAuditQuery,
  AppApiEntityReadQuery,
  AppApiFinanceActionInput,
  AppApiFinanceDocumentQuery,
} from "./app-api-contracts.js"
import { APP_API_VERSION } from "./app-api-contracts.js"
import { appAuditEvents, appGrants, appReleases, appWebhookSubscriptions } from "./schema.js"

export interface AppApiAccessContext {
  appId: string
  installationId: string
  releaseId: string
  tokenMode: "offline" | "online"
  viewerId?: string
  scopes: readonly string[]
  apiVersion?: string
}

export interface AppApiEntityReader {
  list(db: PostgresJsDatabase, query: AppApiEntityReadQuery): Promise<unknown>
}

export interface AppApiFinanceRuntime {
  listDocuments(db: PostgresJsDatabase, query: AppApiFinanceDocumentQuery): Promise<unknown>
  executeAction(db: PostgresJsDatabase, input: AppApiFinanceActionInput): Promise<unknown>
}

export interface AppApiRateLimitPolicy {
  installationLimit: number
  appLimit: number
  windowMs: number
}

export interface AppApiServiceOptions {
  entityReaders?: Readonly<Record<string, AppApiEntityReader>>
  finance?: AppApiFinanceRuntime
  customFieldTargets?: Parameters<typeof createCustomFieldsService>[0]
  customFieldValueLifecycles?: readonly CustomFieldValueLifecycleRuntime[]
  customFieldValueOperations?: readonly CustomFieldValueOperationsRuntime[]
  rateLimit?: AppApiRateLimitPolicy
  now?: () => Date
}

const DEFAULT_RATE_LIMIT = { installationLimit: 120, appLimit: 600, windowMs: 60_000 }
const REMOTE_APP_NAMESPACE = /^\$app(?::[a-z][a-z0-9-]*)?$/
const PHYSICAL_APP_NAMESPACE = /^app--/

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function createAppApiService(options: AppApiServiceOptions = {}) {
  const now = () => options.now?.() ?? new Date()
  const customFields =
    options.customFieldTargets &&
    createCustomFieldsService(
      options.customFieldTargets,
      options.customFieldValueLifecycles ?? [],
      options.customFieldValueOperations ?? [],
    )

  async function introspect(db: PostgresJsDatabase, context: AppApiAccessContext) {
    const access = await requireAccess(db, context, ["app-installation:read"])
    const grants = await db
      .select({
        scope: appGrants.scope,
        status: appGrants.status,
        optional: appGrants.optional,
      })
      .from(appGrants)
      .where(eq(appGrants.installationId, context.installationId))
      .orderBy(appGrants.scope)
    return {
      data: {
        installation: {
          id: access.installation.id,
          appId: access.installation.appId,
          status: access.installation.status,
          namespace: access.installation.namespace,
          deploymentId: access.installation.deploymentId,
        },
        release: {
          id: access.release.id,
          version: access.release.releaseVersion,
          apiCompatibility: access.release.apiCompatibility,
        },
        grants,
      },
    }
  }

  async function listEntities(
    db: PostgresJsDatabase,
    context: AppApiAccessContext,
    entity: string,
    query: AppApiEntityReadQuery,
  ) {
    await requireAccess(db, context, [`${entity}:read`])
    const reader = options.entityReaders?.[entity]
    if (!reader) throw notSupported(`Entity "${entity}" is not supported by the App API.`)
    return { data: await reader.list(db, query) }
  }

  async function listFinanceDocuments(
    db: PostgresJsDatabase,
    context: AppApiAccessContext,
    query: AppApiFinanceDocumentQuery,
  ) {
    await requireAccess(db, context, ["finance-documents:read"])
    if (!options.finance) throw notSupported("Finance App API runtime is not configured.")
    return { data: await options.finance.listDocuments(db, query) }
  }

  async function executeFinanceAction(
    db: PostgresJsDatabase,
    context: AppApiAccessContext,
    input: AppApiFinanceActionInput,
  ) {
    await requireAccess(db, context, [`finance-actions:${input.action}`])
    if (!options.finance) throw notSupported("Finance App API runtime is not configured.")
    if (!input.approvalId) {
      throw new ApiHttpError("Finance action requires action-ledger approval.", {
        status: 403,
        code: "app_api_finance_approval_required",
      })
    }
    return { data: await options.finance.executeAction(db, input) }
  }

  async function listCustomFieldDefinitions(
    db: PostgresJsDatabase,
    context: AppApiAccessContext,
    query: Parameters<NonNullable<typeof customFields>["listForOwner"]>[2],
  ) {
    const access = await requireAccess(db, context, ["custom-field-definitions:read"])
    return customFieldsRequired().listForOwner(db, owner(access), query)
  }

  async function createCustomFieldDefinition(
    db: PostgresJsDatabase,
    context: AppApiAccessContext,
    namespace: string | undefined,
    input: Parameters<NonNullable<typeof customFields>["createForOwner"]>[2],
  ) {
    assertAppNamespaceAlias(namespace)
    const access = await requireAccess(db, context, ["custom-field-definitions:write"])
    return { data: await customFieldsRequired().createForOwner(db, owner(access), input) }
  }

  async function updateCustomFieldDefinition(
    db: PostgresJsDatabase,
    context: AppApiAccessContext,
    id: string,
    namespace: string | undefined,
    input: Parameters<NonNullable<typeof customFields>["updateForOwner"]>[3],
  ) {
    assertAppNamespaceAlias(namespace)
    const access = await requireAccess(db, context, ["custom-field-definitions:write"])
    const data = await customFieldsRequired().updateForOwner(db, owner(access), id, input)
    if (!data) throw notFound("Custom-field definition not found.")
    return { data }
  }

  async function listCustomFieldValues(
    db: PostgresJsDatabase,
    context: AppApiAccessContext,
    query: Parameters<NonNullable<typeof customFields>["values"]["listForOwner"]>[2],
  ) {
    await requireAccess(db, context, [`custom-field-values:${query.entityType ?? "read"}`])
    const access = await requireAccess(db, context, ["custom-field-values:read"])
    return customFieldsRequired().values.listForOwner(db, owner(access), query)
  }

  async function upsertCustomFieldValue(
    db: PostgresJsDatabase,
    context: AppApiAccessContext,
    definitionId: string,
    input: Parameters<NonNullable<typeof customFields>["values"]["upsertForOwner"]>[3],
  ) {
    await requireAccess(db, context, [
      "custom-field-values:write",
      `custom-field-values:${input.entityType}`,
    ])
    const access = await requireAccess(db, context, [])
    return {
      data: await customFieldsRequired().values.upsertForOwner(
        db,
        owner(access),
        definitionId,
        input,
      ),
    }
  }

  async function listWebhookHealth(db: PostgresJsDatabase, context: AppApiAccessContext) {
    await requireAccess(db, context, ["webhooks:read"])
    const data = await db
      .select()
      .from(appWebhookSubscriptions)
      .where(eq(appWebhookSubscriptions.installationId, context.installationId))
      .orderBy(asc(appWebhookSubscriptions.eventType))
    return { data }
  }

  async function listAuditHistory(
    db: PostgresJsDatabase,
    context: AppApiAccessContext,
    query: AppApiAuditQuery,
  ) {
    await requireAccess(db, context, ["app-audit:read"])
    const where = and(
      eq(appAuditEvents.appId, context.appId),
      eq(appAuditEvents.installationId, context.installationId),
    )
    const [data, count] = await Promise.all([
      db.select().from(appAuditEvents).where(where).limit(query.limit).offset(query.offset),
      db.select({ count: sql<number>`count(*)::int` }).from(appAuditEvents).where(where),
    ])
    return { data, total: count[0]?.count ?? 0, limit: query.limit, offset: query.offset }
  }

  return {
    introspect,
    listEntities,
    listFinanceDocuments,
    executeFinanceAction,
    listCustomFieldDefinitions,
    createCustomFieldDefinition,
    updateCustomFieldDefinition,
    listCustomFieldValues,
    upsertCustomFieldValue,
    listWebhookHealth,
    listAuditHistory,
    requireAccess,
    enforceRateLimit,
  }

  async function requireAccess(
    db: PostgresJsDatabase,
    context: AppApiAccessContext,
    requiredScopes: readonly string[],
  ) {
    enforceRateLimit(context)
    // The token's own scopes are the authority: for online tokens this is the
    // narrowed viewer/context intersection minted at exchange, so an endpoint
    // must not be reachable just because the installation was granted its
    // scope. The installation-grant check below stays as defense in depth.
    const tokenScopes = new Set(context.scopes)
    const missingFromToken = requiredScopes.filter((scope) => !tokenScopes.has(scope))
    if (missingFromToken.length > 0) {
      throw new ApiHttpError("App token is missing required scopes", {
        status: 403,
        code: "app_api_token_scope_missing",
        details: { scopes: [...missingFromToken].sort() },
      })
    }
    const installation = await assertActiveAppInstallationAccess(db, {
      installationId: context.installationId,
      requiredScopes,
    })
    if (installation.appId !== context.appId || installation.releaseId !== context.releaseId) {
      throw new ApiHttpError("App token does not match the active installation.", {
        status: 403,
        code: "app_api_token_installation_mismatch",
      })
    }
    const [release] = await db
      .select()
      .from(appReleases)
      .where(eq(appReleases.id, installation.releaseId))
      .limit(1)
    if (!release) throw notFound("Installed app release not found.")
    assertCompatibleVersion(context.apiVersion ?? APP_API_VERSION, release.apiCompatibility)
    return { installation, release }
  }

  function enforceRateLimit(context: AppApiAccessContext) {
    const policy = options.rateLimit ?? DEFAULT_RATE_LIMIT
    hit(`installation:${context.installationId}`, policy.installationLimit, policy.windowMs)
    hit(`app:${context.appId}`, policy.appLimit, policy.windowMs)
  }

  function hit(key: string, limit: number, windowMs: number) {
    const timestamp = now().getTime()
    const bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= timestamp) {
      buckets.set(key, { count: 1, resetAt: timestamp + windowMs })
      return
    }
    if (bucket.count >= limit) {
      throw new ApiHttpError("App API rate limit exceeded.", {
        status: 429,
        code: "app_api_rate_limited",
        details: { key, resetAt: new Date(bucket.resetAt).toISOString() },
      })
    }
    bucket.count += 1
  }

  function owner(access: Awaited<ReturnType<typeof requireAccess>>): CustomFieldDefinitionOwner {
    return createAppCustomFieldDefinitionOwner({
      appId: access.installation.appId,
      namespace: access.installation.namespace,
    })
  }

  function customFieldsRequired() {
    if (!customFields) throw notSupported("Custom fields App API runtime is not configured.")
    return customFields
  }
}

export function assertAppNamespaceAlias(namespace: string | undefined) {
  if (!namespace || namespace === "$app") return
  if (PHYSICAL_APP_NAMESPACE.test(namespace) || !REMOTE_APP_NAMESPACE.test(namespace)) {
    throw new ApiHttpError("App APIs accept only the server-resolved $app namespace alias.", {
      status: 400,
      code: "app_api_invalid_custom_field_namespace",
    })
  }
}

export function assertCompatibleVersion(requested: string, range: { min: string; max: string }) {
  if (requested < range.min || requested > range.max) {
    throw new ApiHttpError("Requested App API version is outside the installed release range.", {
      status: 426,
      code: "app_api_version_out_of_range",
      details: { requested, supported: range },
    })
  }
}

export async function withAppApiDeadline<T>(promise: Promise<T>, timeoutMs = 5_000): Promise<T> {
  let timeout: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new ApiHttpError("App API request deadline exceeded.", {
                status: 504,
                code: "app_api_deadline_exceeded",
              }),
            ),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function notSupported(message: string) {
  return new ApiHttpError(message, { status: 501, code: "app_api_not_configured" })
}

function notFound(message: string) {
  return new ApiHttpError(message, { status: 404, code: "not_found" })
}
