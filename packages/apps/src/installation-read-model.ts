import { and, desc, eq, getTableColumns, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { AppInstallationListQuery } from "./contracts.js"
import {
  type AppInstallation,
  type AppRegistration,
  type AppRelease,
  appAuditEvents,
  appExtensionInstallations,
  appGrants,
  appInstallations,
  appReleases,
  apps,
} from "./schema.js"
import { listAppWebhookHealth } from "./webhook-delivery.js"

export type AppGrantRow = typeof appGrants.$inferSelect
export type AppExtensionInstallationRow = typeof appExtensionInstallations.$inferSelect
export type AppAuditEventRow = typeof appAuditEvents.$inferSelect
export type AppWebhookHealth = Awaited<ReturnType<typeof listAppWebhookHealth>>

/**
 * A single installation as shown in a governance list: the installation row
 * plus the joined app and active-release descriptors the UI renders per row.
 */
export interface InstallationSummary extends AppInstallation {
  appDisplayName: string
  appSlug: string
  distribution: AppRegistration["distribution"]
  releaseVersion: string
}

export interface InstallationListResult {
  data: InstallationSummary[]
  total: number
  limit: number
  offset: number
}

/**
 * A release the installation could move to, with whether governance can apply
 * it without new consent and why it is blocked when it cannot.
 */
export interface AppAvailableUpdate {
  release: AppRelease
  blocked: boolean
  blockedReason: string | null
}

export interface InstallationDetail {
  installation: AppInstallation
  app: AppRegistration
  activeRelease: AppRelease
  pendingRelease: AppRelease | null
  pendingReason: string | null
  grants: AppGrantRow[]
  extensions: AppExtensionInstallationRow[]
  webhooks: AppWebhookHealth
  recentAudit: AppAuditEventRow[]
  availableUpdates: AppAvailableUpdate[]
}

export interface AvailableUpdateOptions {
  platformApiVersion?: string
}

export async function listInstallationSummaries(
  db: PostgresJsDatabase,
  query: AppInstallationListQuery,
): Promise<InstallationListResult> {
  const where = and(
    query.appId ? eq(appInstallations.appId, query.appId) : undefined,
    query.status ? eq(appInstallations.status, query.status) : undefined,
    query.deploymentId ? eq(appInstallations.deploymentId, query.deploymentId) : undefined,
  )
  const [data, count] = await Promise.all([
    db
      .select({
        ...getTableColumns(appInstallations),
        appDisplayName: apps.displayName,
        appSlug: apps.slug,
        distribution: apps.distribution,
        releaseVersion: appReleases.releaseVersion,
      })
      .from(appInstallations)
      .innerJoin(apps, eq(apps.id, appInstallations.appId))
      .innerJoin(appReleases, eq(appReleases.id, appInstallations.releaseId))
      .where(where)
      .orderBy(desc(appInstallations.installedAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ count: sql<number>`count(*)::int` }).from(appInstallations).where(where),
  ])
  return { data, total: count[0]?.count ?? 0, limit: query.limit, offset: query.offset }
}

export async function listAppReleases(
  db: PostgresJsDatabase,
  appId: string,
): Promise<AppRelease[]> {
  return db
    .select()
    .from(appReleases)
    .where(eq(appReleases.appId, appId))
    .orderBy(desc(appReleases.createdAt))
}

export async function listInstallationAudit(
  db: PostgresJsDatabase,
  installationId: string,
  limit: number,
): Promise<AppAuditEventRow[]> {
  return db
    .select()
    .from(appAuditEvents)
    .where(eq(appAuditEvents.installationId, installationId))
    .orderBy(desc(appAuditEvents.createdAt))
    .limit(limit)
}

export async function loadInstallationDetail(
  db: PostgresJsDatabase,
  installationId: string,
  options: AvailableUpdateOptions = {},
): Promise<InstallationDetail | null> {
  const [installation] = await db
    .select()
    .from(appInstallations)
    .where(eq(appInstallations.id, installationId))
    .limit(1)
  if (!installation) return null

  const [app] = await db.select().from(apps).where(eq(apps.id, installation.appId)).limit(1)
  if (!app) return null

  const [activeRelease] = await db
    .select()
    .from(appReleases)
    .where(eq(appReleases.id, installation.releaseId))
    .limit(1)
  if (!activeRelease) return null

  const [grants, extensions, webhooks, recentAudit, candidateReleases, pendingRelease] =
    await Promise.all([
      db
        .select()
        .from(appGrants)
        .where(eq(appGrants.installationId, installation.id))
        .orderBy(appGrants.scope),
      db
        .select()
        .from(appExtensionInstallations)
        .where(eq(appExtensionInstallations.installationId, installation.id))
        .orderBy(appExtensionInstallations.extensionKey),
      listAppWebhookHealth(db, installation.id),
      listInstallationAudit(db, installation.id, 20),
      db
        .select()
        .from(appReleases)
        .where(and(eq(appReleases.appId, installation.appId), eq(appReleases.state, "available"))),
      loadPendingRelease(db, installation.pendingReleaseId),
    ])

  const grantedScopes = new Set(
    grants.filter((grant) => grant.status === "granted").map((grant) => grant.scope),
  )
  const availableUpdates = computeAvailableUpdates({
    installation,
    candidateReleases,
    grantedScopes,
    platformApiVersion: options.platformApiVersion,
  })

  return {
    installation,
    app,
    activeRelease,
    pendingRelease,
    pendingReason: installation.pendingReason ?? null,
    grants,
    extensions,
    webhooks,
    recentAudit,
    availableUpdates,
  }
}

/**
 * Pure evaluation of which other available releases a governance operator can
 * roll to. A candidate is blocked when it requires scopes the installation has
 * not already granted, or when it falls outside the platform API range (only
 * checked when a platform API version is known).
 */
export function computeAvailableUpdates(input: {
  installation: Pick<AppInstallation, "releaseId">
  candidateReleases: readonly AppRelease[]
  grantedScopes: ReadonlySet<string>
  platformApiVersion?: string
}): AppAvailableUpdate[] {
  const updates: AppAvailableUpdate[] = []
  for (const release of input.candidateReleases) {
    if (release.id === input.installation.releaseId) continue
    updates.push({
      release,
      ...evaluateUpdateBlock(release, input.grantedScopes, input.platformApiVersion),
    })
  }
  return updates
}

function evaluateUpdateBlock(
  release: AppRelease,
  grantedScopes: ReadonlySet<string>,
  platformApiVersion?: string,
): { blocked: boolean; blockedReason: string | null } {
  const required = readRequestedScopes(release.normalizedRecord)
  const missing = required.filter((scope) => !grantedScopes.has(scope))
  if (missing.length > 0) {
    return {
      blocked: true,
      blockedReason: `New required scopes need consent: ${missing.join(", ")}`,
    }
  }
  if (platformApiVersion && !isApiCompatible(release.apiCompatibility, platformApiVersion)) {
    return { blocked: true, blockedReason: "Release is not API-compatible with this platform" }
  }
  return { blocked: false, blockedReason: null }
}

function isApiCompatible(range: { min: string; max: string }, platformApiVersion: string): boolean {
  return platformApiVersion >= range.min && platformApiVersion <= range.max
}

async function loadPendingRelease(
  db: PostgresJsDatabase,
  pendingReleaseId: string | null,
): Promise<AppRelease | null> {
  if (!pendingReleaseId) return null
  const [row] = await db
    .select()
    .from(appReleases)
    .where(eq(appReleases.id, pendingReleaseId))
    .limit(1)
  return row ?? null
}

function readRequestedScopes(normalizedRecord: Record<string, unknown>): string[] {
  const value = normalizedRecord.requestedScopes
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}
