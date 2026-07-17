import type { EventBus } from "@voyant-travel/core/events"
import type { createCustomFieldsService } from "@voyant-travel/custom-fields"
import { ApiHttpError } from "@voyant-travel/hono"
import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  audit,
  countInstallationRows,
  deactivateResolvedRegistrations,
  deactivateRuntimeState,
  markAppDefinitionsInactive,
  newlyRequiredScopes,
  reconcileGrants,
  reconcileRelease,
  rotateCredential,
} from "./installation-reconciliation.js"
import { canInstallOver, invalidTransition, planLifecycleTransition } from "./installation-state.js"
import {
  type AppInstallation,
  type AppRegistration,
  type AppRelease,
  appAccessCredentials,
  appExtensionInstallations,
  appGrants,
  appInstallations,
  appReleases,
  apps,
  appWebhookSubscriptions,
} from "./schema.js"

export type AppInstallationStatus = AppInstallation["status"]
export type AppInstallationUpdatePolicy = AppInstallation["updatePolicy"]
type CustomFieldsService = ReturnType<typeof createCustomFieldsService>

export const APP_INSTALLATION_ACTIVE_EVENT = "app.installation.active" as const
export const APP_INSTALLATION_PAUSED_EVENT = "app.installation.paused" as const
export const APP_INSTALLATION_UNINSTALLED_EVENT = "app.installation.uninstalled" as const
export const APP_INSTALLATION_UPGRADED_EVENT = "app.installation.upgraded" as const
export const APP_INSTALLATION_UPGRADE_PENDING_EVENT = "app.installation.upgrade_pending" as const

export interface AppInstallationServiceOptions {
  eventBus?: EventBus
  customFields?: CustomFieldsService
  platformApiVersion?: string
  deploymentId?: string
}

export interface InstallAppInput {
  appId: string
  releaseId: string
  deploymentId?: string
  actorId: string
  updatePolicy?: AppInstallationUpdatePolicy
  grantedOptionalScopes?: readonly string[]
  credential?: AppCredentialInput
}

export interface UpgradeAppInput {
  installationId: string
  releaseId: string
  actorId: string
  credential?: AppCredentialInput
}

export interface AppCredentialInput {
  credentialHash: string
  encryptedMetadata: Record<string, unknown>
  expiresAt?: Date | null
}

export interface LifecycleActionInput {
  installationId: string
  actorId: string
}

export interface PurgePreviewInput {
  installationId: string
  actorId: string
}

export interface ResolvedActiveInstallation {
  installation: AppInstallation
  effectiveScopes: readonly string[]
}

export function createAppInstallationService(options: AppInstallationServiceOptions = {}) {
  const deploymentId = (input?: { deploymentId?: string }) => {
    const resolved = input?.deploymentId ?? options.deploymentId
    if (!resolved) {
      throw new ApiHttpError("Deployment identity is required", {
        status: 400,
        code: "app_deployment_required",
      })
    }
    return resolved
  }

  async function install(db: PostgresJsDatabase, input: InstallAppInput) {
    const resolvedDeploymentId = deploymentId(input)
    return db.transaction(async (tx) => {
      const release = await requireReleaseForApp(tx, input.appId, input.releaseId)
      assertReleaseAvailable(release)
      assertApiCompatible(release, options.platformApiVersion)
      const app = await requireApp(tx, input.appId)
      const existing = await selectInstallationByDeploymentApp(
        tx,
        resolvedDeploymentId,
        input.appId,
        true,
      )
      if (existing && !canInstallOver(existing.status)) {
        if (existing.releaseId !== input.releaseId) {
          throw invalidTransition(existing.status, "install_different_release")
        }
        await audit(tx, existing, input.actorId, "lifecycle", "install.idempotent", {})
        return { installation: existing, outcome: "unchanged" as const }
      }

      const installation = existing
        ? await reactivateInstallation(tx, existing, release, input)
        : await createInstallation(tx, app, release, resolvedDeploymentId, input)
      await reconcileRelease(tx, installation, release, input.actorId, "install", options)
      await reconcileGrants(tx, installation, release, input.actorId, input.grantedOptionalScopes)
      if (input.credential) {
        await rotateCredential(tx, installation, input.credential, input.actorId)
      }
      await audit(tx, installation, input.actorId, "lifecycle", "install.active", {
        transitions: ["pending", "authorizing", "active"],
        releaseId: release.id,
      })
      await emitLifecycle(installation, "active")
      return { installation, outcome: existing ? ("reinstalled" as const) : ("created" as const) }
    })
  }

  async function upgrade(db: PostgresJsDatabase, input: UpgradeAppInput) {
    return db.transaction(async (tx) => {
      const installation = await requireInstallation(tx, input.installationId, true)
      if (!["active", "paused", "degraded"].includes(installation.status)) {
        throw invalidTransition(installation.status, "upgrade")
      }
      const release = await requireReleaseForApp(tx, installation.appId, input.releaseId)
      assertReleaseAvailable(release)
      assertApiCompatible(release, options.platformApiVersion)
      const missingScopes = await newlyRequiredScopes(tx, installation, release)
      if (missingScopes.length > 0) {
        const [pending] = await tx
          .update(appInstallations)
          .set({
            pendingReleaseId: release.id,
            pendingReason: `New required scopes need consent: ${missingScopes.join(", ")}`,
            updatedAt: new Date(),
          })
          .where(eq(appInstallations.id, installation.id))
          .returning()
        const row = pending ?? installation
        await audit(tx, row, input.actorId, "grant", "upgrade.pending_consent", { missingScopes })
        await emitLifecycle(row, "upgrade_pending")
        return { installation: row, outcome: "pending_consent" as const, missingScopes }
      }

      await deactivateResolvedRegistrations(tx, installation)
      if (input.credential) {
        await rotateCredential(tx, installation, input.credential, input.actorId)
      }
      const [upgraded] = await tx
        .update(appInstallations)
        .set({
          releaseId: release.id,
          pendingReleaseId: null,
          pendingReason: null,
          updatedAt: new Date(),
        })
        .where(eq(appInstallations.id, installation.id))
        .returning()
      const row = upgraded ?? installation
      await reconcileRelease(tx, row, release, input.actorId, "upgrade", options)
      await reconcileGrants(tx, row, release, input.actorId, [])
      await audit(tx, row, input.actorId, "lifecycle", "upgrade.active", { releaseId: release.id })
      await emitLifecycle(row, "upgraded")
      return { installation: row, outcome: "upgraded" as const, missingScopes: [] }
    })
  }

  async function pause(db: PostgresJsDatabase, input: LifecycleActionInput) {
    return transition(db, input, ["active", "degraded"], "paused", "pause", async (tx, row) => {
      await deactivateRuntimeState(tx, row)
    })
  }

  async function resume(db: PostgresJsDatabase, input: LifecycleActionInput) {
    return transition(db, input, ["paused"], "active", "resume", async (tx, row) => {
      const release = await requireReleaseForApp(tx, row.appId, row.releaseId)
      await reconcileRelease(tx, row, release, input.actorId, "resume", options)
    })
  }

  async function uninstall(db: PostgresJsDatabase, input: LifecycleActionInput) {
    return transition(
      db,
      input,
      ["active", "paused", "degraded"],
      "uninstalled",
      "uninstall",
      async (tx, row) => {
        await deactivateRuntimeState(tx, row)
        await markAppDefinitionsInactive(tx, row, input.actorId)
      },
    )
  }

  async function purgePreview(db: PostgresJsDatabase, input: PurgePreviewInput) {
    const installation = await requireInstallation(db, input.installationId, false)
    if (installation.status !== "uninstalled") {
      throw invalidTransition(installation.status, "purge_preview")
    }
    const [grants, credentials, extensions, webhooks] = await Promise.all([
      countInstallationRows(db, appGrants, installation.id),
      countInstallationRows(db, appAccessCredentials, installation.id),
      countInstallationRows(db, appExtensionInstallations, installation.id),
      countInstallationRows(db, appWebhookSubscriptions, installation.id),
    ])
    await audit(db, installation, input.actorId, "purge", "purge.preview", {
      grants,
      credentials,
      extensions,
      webhooks,
    })
    return { installation, grants, credentials, extensions, webhooks }
  }

  async function resolveActiveInstallation(
    db: PostgresJsDatabase,
    installationId: string,
  ): Promise<ResolvedActiveInstallation | null> {
    const installation = await selectInstallationById(db, installationId, false)
    if (installation?.status !== "active") return null
    const grants = await db
      .select({ scope: appGrants.scope })
      .from(appGrants)
      .where(and(eq(appGrants.installationId, installation.id), eq(appGrants.status, "granted")))
      .orderBy(appGrants.scope)
    return { installation, effectiveScopes: grants.map((grant) => grant.scope) }
  }

  return { install, upgrade, pause, resume, uninstall, purgePreview, resolveActiveInstallation }

  async function emitLifecycle(
    installation: AppInstallation,
    event: "active" | "paused" | "uninstalled" | "upgraded" | "upgrade_pending",
  ) {
    const data = {
      appId: installation.appId,
      installationId: installation.id,
      deploymentId: installation.deploymentId,
    }
    const metadata = { category: "internal", source: "service" } as const
    if (event === "active") {
      await options.eventBus?.emit(APP_INSTALLATION_ACTIVE_EVENT, data, metadata)
    } else if (event === "paused") {
      await options.eventBus?.emit(APP_INSTALLATION_PAUSED_EVENT, data, metadata)
    } else if (event === "uninstalled") {
      await options.eventBus?.emit(APP_INSTALLATION_UNINSTALLED_EVENT, data, metadata)
    } else if (event === "upgraded") {
      await options.eventBus?.emit(APP_INSTALLATION_UPGRADED_EVENT, data, metadata)
    } else {
      await options.eventBus?.emit(APP_INSTALLATION_UPGRADE_PENDING_EVENT, data, metadata)
    }
  }

  async function transition(
    db: PostgresJsDatabase,
    input: LifecycleActionInput,
    from: readonly AppInstallationStatus[],
    to: AppInstallationStatus,
    action: string,
    sideEffect: (tx: PostgresJsDatabase, row: AppInstallation) => Promise<void>,
  ) {
    return db.transaction(async (tx) => {
      const current = await requireInstallation(tx, input.installationId, true)
      const plan = planLifecycleTransition(current.status, from, to, action)
      if (plan.outcome === "unchanged") {
        await audit(tx, current, input.actorId, "lifecycle", `${action}.idempotent`, {})
        return { installation: current, outcome: "unchanged" as const }
      }
      await sideEffect(tx, current)
      const now = new Date()
      const [updated] = await tx
        .update(appInstallations)
        .set(lifecyclePatch(to, now))
        .where(eq(appInstallations.id, current.id))
        .returning()
      const row = updated ?? { ...current, status: to }
      await audit(tx, row, input.actorId, "lifecycle", `${action}.${to}`, { from: current.status })
      if (to === "active" || to === "paused" || to === "uninstalled") {
        await emitLifecycle(row, to)
      }
      return { installation: row, outcome: "updated" as const }
    })
  }
}

async function createInstallation(
  db: PostgresJsDatabase,
  app: AppRegistration,
  release: AppRelease,
  deploymentId: string,
  input: InstallAppInput,
) {
  const now = new Date()
  const [row] = await db
    .insert(appInstallations)
    .values({
      appId: app.id,
      deploymentId,
      releaseId: release.id,
      status: "active",
      namespace: app.platformNamespace,
      installedBy: input.actorId,
      updatePolicy: input.updatePolicy ?? "compatible",
      authorizedAt: now,
      activatedAt: now,
    })
    .returning()
  if (!row) throw writeFailed()
  return row
}

async function reactivateInstallation(
  db: PostgresJsDatabase,
  existing: AppInstallation,
  release: AppRelease,
  input: InstallAppInput,
) {
  const now = new Date()
  const [row] = await db
    .update(appInstallations)
    .set({
      releaseId: release.id,
      status: "active",
      updatePolicy: input.updatePolicy ?? existing.updatePolicy,
      pendingReleaseId: null,
      pendingReason: null,
      authorizedAt: now,
      activatedAt: now,
      uninstalledAt: null,
      revokedAt: null,
      updatedAt: now,
    })
    .where(eq(appInstallations.id, existing.id))
    .returning()
  return row ?? existing
}

async function requireApp(db: PostgresJsDatabase, appId: string) {
  const [row] = await db.select().from(apps).where(eq(apps.id, appId)).for("update").limit(1)
  if (!row)
    throw new ApiHttpError("App registration not found", { status: 404, code: "app_not_found" })
  return row
}

async function requireReleaseForApp(db: PostgresJsDatabase, appId: string, releaseId: string) {
  const [row] = await db
    .select()
    .from(appReleases)
    .where(and(eq(appReleases.id, releaseId), eq(appReleases.appId, appId)))
    .for("update")
    .limit(1)
  if (!row)
    throw new ApiHttpError("App release not found", { status: 404, code: "app_release_not_found" })
  return row
}

async function requireInstallation(db: PostgresJsDatabase, id: string, lock: boolean) {
  const row = await selectInstallationById(db, id, lock)
  if (!row) {
    throw new ApiHttpError("App installation not found", {
      status: 404,
      code: "app_installation_not_found",
    })
  }
  return row
}

async function selectInstallationById(db: PostgresJsDatabase, id: string, lock: boolean) {
  const query = db.select().from(appInstallations).where(eq(appInstallations.id, id))
  const [row] = lock ? await query.for("update").limit(1) : await query.limit(1)
  return row ?? null
}

async function selectInstallationByDeploymentApp(
  db: PostgresJsDatabase,
  deploymentId: string,
  appId: string,
  lock: boolean,
) {
  const query = db
    .select()
    .from(appInstallations)
    .where(and(eq(appInstallations.deploymentId, deploymentId), eq(appInstallations.appId, appId)))
  const [row] = lock ? await query.for("update").limit(1) : await query.limit(1)
  return row ?? null
}

function assertReleaseAvailable(release: AppRelease) {
  if (release.state !== "available") {
    throw new ApiHttpError("App release is not available", {
      status: 409,
      code: "app_release_unavailable",
    })
  }
}

function assertApiCompatible(release: AppRelease, platformApiVersion?: string) {
  if (!platformApiVersion) return
  const range = release.apiCompatibility
  if (platformApiVersion < range.min || platformApiVersion > range.max) {
    throw new ApiHttpError("App release is not compatible with this platform API version", {
      status: 409,
      code: "app_release_incompatible",
    })
  }
}

function lifecyclePatch(to: AppInstallationStatus, now: Date) {
  const base = { status: to, updatedAt: now }
  if (to === "active") return { ...base, activatedAt: now }
  if (to === "paused") return { ...base, pausedAt: now }
  if (to === "degraded") return { ...base, degradedAt: now }
  if (to === "revoked") return { ...base, revokedAt: now }
  if (to === "uninstalled") return { ...base, uninstalledAt: now }
  return base
}

function writeFailed() {
  return new ApiHttpError("Could not write app installation", {
    status: 500,
    code: "app_installation_write_failed",
  })
}
