import { z } from "zod"

/**
 * Response schemas for the `/v1/admin/apps/*` admin API. Timestamps arrive as
 * ISO strings (Drizzle rows serialized to JSON); JSONB columns are surfaced as
 * loose records because the UI only reads a documented subset of their keys.
 */

const list = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    data: z.array(schema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  })
const single = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema })
const collection = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: z.array(schema) })

export const appDistribution = z.enum(["custom", "marketplace"])
export const appLifecycleState = z.enum(["active", "suspended", "deleted"])
export const appInstallationStatus = z.enum([
  "pending",
  "authorizing",
  "active",
  "paused",
  "degraded",
  "revoked",
  "uninstalled",
])
export const appUpdatePolicy = z.enum(["manual", "compatible", "patch", "pinned"])
export const appGrantStatus = z.enum(["requested", "granted", "optional", "revoked"])
export const appAuditKind = z.enum([
  "lifecycle",
  "grant",
  "consent",
  "credential",
  "token",
  "reconciliation",
  "purge",
])

export const appRecordSchema = z.object({
  id: z.string(),
  platformNamespace: z.string(),
  distribution: appDistribution,
  ownerId: z.string(),
  displayName: z.string(),
  slug: z.string(),
  lifecycleState: appLifecycleState,
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type AppRecord = z.infer<typeof appRecordSchema>

export const appReleaseSchema = z.object({
  id: z.string(),
  appId: z.string(),
  releaseVersion: z.string(),
  manifestSchemaVersion: z.string(),
  manifestDigest: z.string(),
  manifestSnapshot: z.record(z.string(), z.unknown()),
  normalizedRecord: z.record(z.string(), z.unknown()),
  apiCompatibility: z.object({ min: z.string(), max: z.string() }),
  defaultLocale: z.string(),
  supportedLocales: z.array(z.string()),
  state: z.enum(["available", "suspended", "yanked"]),
  createdBy: z.string(),
  createdAt: z.string(),
})
export type AppReleaseRecord = z.infer<typeof appReleaseSchema>

export const appInstallationSchema = z.object({
  id: z.string(),
  appId: z.string(),
  deploymentId: z.string(),
  releaseId: z.string(),
  status: appInstallationStatus,
  namespace: z.string(),
  installedBy: z.string(),
  credentialGeneration: z.number(),
  updatePolicy: appUpdatePolicy,
  pendingReleaseId: z.string().nullable(),
  pendingReason: z.string().nullable(),
  installedAt: z.string(),
  activatedAt: z.string().nullable(),
  pausedAt: z.string().nullable(),
  uninstalledAt: z.string().nullable(),
  purgedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type AppInstallationRecord = z.infer<typeof appInstallationSchema>

export const appInstallationSummarySchema = appInstallationSchema.extend({
  appDisplayName: z.string(),
  appSlug: z.string(),
  distribution: appDistribution,
  releaseVersion: z.string(),
})
export type AppInstallationSummary = z.infer<typeof appInstallationSummarySchema>

export const appGrantSchema = z.object({
  id: z.string(),
  installationId: z.string(),
  scope: z.string(),
  status: appGrantStatus,
  optional: z.boolean(),
  requestedAt: z.string(),
  grantedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
})
export type AppGrantRecord = z.infer<typeof appGrantSchema>

export const appExtensionSchema = z.object({
  id: z.string(),
  installationId: z.string(),
  releaseId: z.string(),
  extensionKey: z.string(),
  descriptor: z.record(z.string(), z.unknown()),
  status: z.enum(["active", "inactive"]),
  installedAt: z.string(),
  deactivatedAt: z.string().nullable(),
})
export type AppExtensionRecord = z.infer<typeof appExtensionSchema>

export const appWebhookSubscriptionSchema = z.object({
  id: z.string(),
  installationId: z.string(),
  eventType: z.string(),
  eventVersion: z.string(),
  endpointUrl: z.string(),
  status: z.enum(["active", "inactive", "failed"]),
  lastDeliveryAt: z.string().nullable(),
  failureCount: z.number(),
  pausedAt: z.string().nullable(),
})
export type AppWebhookSubscriptionRecord = z.infer<typeof appWebhookSubscriptionSchema>

export const appAuditEventSchema = z.object({
  id: z.string(),
  installationId: z.string().nullable(),
  appId: z.string(),
  deploymentId: z.string(),
  actorId: z.string(),
  kind: appAuditKind,
  action: z.string(),
  details: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
})
export type AppAuditEventRecord = z.infer<typeof appAuditEventSchema>

export const appAvailableUpdateSchema = z.object({
  release: appReleaseSchema,
  blocked: z.boolean(),
  blockedReason: z.string().nullable(),
})
export type AppAvailableUpdate = z.infer<typeof appAvailableUpdateSchema>

export const appInstallationDetailSchema = z.object({
  installation: appInstallationSchema,
  app: appRecordSchema,
  activeRelease: appReleaseSchema.nullable(),
  pendingRelease: appReleaseSchema.nullable(),
  pendingReason: z.string().nullable().optional(),
  grants: z.array(appGrantSchema),
  extensions: z.array(appExtensionSchema),
  // `listAppWebhookHealth` returns a `{ data }` envelope, surfaced verbatim.
  webhooks: z.object({ data: z.array(appWebhookSubscriptionSchema) }),
  recentAudit: z.array(appAuditEventSchema),
  availableUpdates: z.array(appAvailableUpdateSchema),
})
export type AppInstallationDetail = z.infer<typeof appInstallationDetailSchema>

const lifecycleOutcomeSchema = z.object({
  installation: appInstallationSchema,
  outcome: z.string(),
  missingScopes: z.array(z.string()).optional(),
})
export type AppLifecycleOutcome = z.infer<typeof lifecycleOutcomeSchema>

export const purgePreviewSchema = z.object({
  installation: appInstallationSchema,
  grants: z.number(),
  credentials: z.number(),
  extensions: z.number(),
  webhooks: z.number(),
})
export type AppPurgePreview = z.infer<typeof purgePreviewSchema>

export const releaseCreateResultSchema = z.object({
  data: appReleaseSchema,
  digest: z.string(),
  created: z.boolean(),
})
export type AppReleaseCreateResult = z.infer<typeof releaseCreateResultSchema>

// Response envelopes.
export const appListResponse = list(appRecordSchema)
export const appSingleResponse = single(appRecordSchema)
export const appReleasesResponse = collection(appReleaseSchema)
export const installationListResponse = list(appInstallationSummarySchema)
export const installationDetailResponse = single(appInstallationDetailSchema)
export const auditListResponse = collection(appAuditEventSchema)
export const webhookHealthResponse = collection(appWebhookSubscriptionSchema)
export const lifecycleResponse = single(lifecycleOutcomeSchema)
export const purgePreviewResponse = single(purgePreviewSchema)
