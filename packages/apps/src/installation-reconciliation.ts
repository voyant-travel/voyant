import {
  createAppCustomFieldDefinitionOwner,
  type createCustomFieldsService,
  customFieldDefinitions,
} from "@voyant-travel/custom-fields"
import { ApiHttpError } from "@voyant-travel/hono"
import { and, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { NormalizedAppReleaseRecord } from "./compiler.js"
import type { AppCredentialInput } from "./installation-service.js"
import {
  type AppInstallation,
  type AppRelease,
  appAccessCredentials,
  appAuditEvents,
  appExtensionInstallations,
  appGrants,
  appOAuthRefreshTokens,
  appWebhookSubscriptions,
} from "./schema.js"

type CustomFieldsService = ReturnType<typeof createCustomFieldsService>

export interface ReconciliationOptions {
  customFields?: CustomFieldsService
}

export async function reconcileRelease(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  release: AppRelease,
  actorId: string,
  action: string,
  options: ReconciliationOptions,
) {
  const normalized = parseNormalizedRelease(release.normalizedRecord)
  await reconcileCustomFields(db, installation, release, normalized, actorId, options)
  await reconcileExtensions(db, installation, release, normalized)
  await reconcileWebhooks(db, installation, release, normalized)
  await audit(db, installation, actorId, "reconciliation", `manifest.${action}`, {
    releaseId: release.id,
    digest: release.manifestDigest,
    customFields: normalized.customFields.length,
    extensions: normalized.adminPages.length + normalized.slotExtensions.length,
    webhooks: normalized.webhooks.length,
  })
}

export async function reconcileGrants(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  release: AppRelease,
  actorId: string,
  grantedOptionalScopes: readonly string[] = [],
) {
  const normalized = parseNormalizedRelease(release.normalizedRecord)
  const optional = new Set(normalized.optionalScopes)
  const grantedOptional = new Set(grantedOptionalScopes)
  for (const scope of [...normalized.requestedScopes, ...normalized.optionalScopes].sort()) {
    const isOptional = optional.has(scope)
    const status = isOptional && !grantedOptional.has(scope) ? "optional" : "granted"
    await db
      .insert(appGrants)
      .values({
        installationId: installation.id,
        scope,
        optional: isOptional,
        status,
        grantedAt: status === "granted" ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [appGrants.installationId, appGrants.scope],
        set: { status, optional: isOptional, revokedAt: null },
      })
  }
  await audit(db, installation, actorId, "grant", "grants.reconciled", {
    requested: normalized.requestedScopes,
    optional: normalized.optionalScopes,
  })
}

export async function newlyRequiredScopes(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  release: AppRelease,
) {
  const normalized = parseNormalizedRelease(release.normalizedRecord)
  const required = new Set(normalized.requestedScopes)
  const existing = await db
    .select({ scope: appGrants.scope })
    .from(appGrants)
    .where(and(eq(appGrants.installationId, installation.id), eq(appGrants.status, "granted")))
  for (const grant of existing) required.delete(grant.scope)
  return [...required].sort()
}

export async function rotateCredential(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  credential: AppCredentialInput,
  actorId: string,
) {
  await db
    .update(appAccessCredentials)
    .set({ status: "inactive", deactivatedAt: new Date() })
    .where(
      and(
        eq(appAccessCredentials.installationId, installation.id),
        eq(appAccessCredentials.status, "active"),
      ),
    )
  const [{ generation = 0 } = {}] = await db
    .select({ generation: sql<number>`coalesce(max(${appAccessCredentials.generation}), 0)::int` })
    .from(appAccessCredentials)
    .where(eq(appAccessCredentials.installationId, installation.id))
  await db.insert(appAccessCredentials).values({
    installationId: installation.id,
    generation: generation + 1,
    credentialHash: credential.credentialHash,
    encryptedMetadata: credential.encryptedMetadata,
    expiresAt: credential.expiresAt ?? null,
  })
  await audit(db, installation, actorId, "credential", "credential.rotated", {
    generation: generation + 1,
  })
}

export async function deactivateRuntimeState(
  db: PostgresJsDatabase,
  installation: AppInstallation,
) {
  const now = new Date()
  await db
    .update(appAccessCredentials)
    .set({ status: "inactive", deactivatedAt: now })
    .where(eq(appAccessCredentials.installationId, installation.id))
  await db
    .update(appOAuthRefreshTokens)
    .set({ status: "revoked", revokedAt: now })
    .where(eq(appOAuthRefreshTokens.installationId, installation.id))
  await deactivateResolvedRegistrations(db, installation)
}

export async function deactivateResolvedRegistrations(
  db: PostgresJsDatabase,
  installation: AppInstallation,
) {
  const now = new Date()
  await db
    .update(appExtensionInstallations)
    .set({ status: "inactive", deactivatedAt: now })
    .where(eq(appExtensionInstallations.installationId, installation.id))
  await db
    .update(appWebhookSubscriptions)
    .set({ status: "inactive", deactivatedAt: now })
    .where(eq(appWebhookSubscriptions.installationId, installation.id))
}

export async function markAppDefinitionsInactive(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  actorId: string,
) {
  await db
    .update(customFieldDefinitions)
    .set({ lifecycleState: "inactive", updatedAt: new Date() })
    .where(
      and(
        eq(customFieldDefinitions.ownerKind, "app"),
        eq(customFieldDefinitions.ownerId, installation.appId),
        eq(customFieldDefinitions.namespace, installation.namespace),
      ),
    )
  await audit(db, installation, actorId, "reconciliation", "custom_fields.inactive", {})
}

export async function countInstallationRows(
  db: PostgresJsDatabase,
  table:
    | typeof appGrants
    | typeof appAccessCredentials
    | typeof appExtensionInstallations
    | typeof appWebhookSubscriptions,
  installationId: string,
) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(eq(table.installationId, installationId))
  return row?.count ?? 0
}

export async function audit(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  actorId: string,
  kind: "lifecycle" | "grant" | "consent" | "credential" | "token" | "reconciliation" | "purge",
  action: string,
  details: Record<string, unknown>,
) {
  await db.insert(appAuditEvents).values({
    installationId: installation.id,
    appId: installation.appId,
    deploymentId: installation.deploymentId,
    actorId,
    kind,
    action,
    details,
  })
}

async function reconcileCustomFields(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  release: AppRelease,
  normalized: NormalizedAppReleaseRecord,
  actorId: string,
  options: ReconciliationOptions,
) {
  if (!options.customFields) return
  const owner = createAppCustomFieldDefinitionOwner({
    appId: installation.appId,
    namespace: installation.namespace,
    provenance: { source: "app-manifest", releaseId: release.id, reconciledBy: actorId },
  })
  const existing = await options.customFields.listForOwner(db, owner, {
    lifecycleState: "active",
    limit: 100,
    offset: 0,
  })
  const existingByIdentity = new Map(
    existing.data.map((definition) => [`${definition.entityType}:${definition.key}`, definition]),
  )
  const declared = new Set<string>()
  for (const field of normalized.customFields) {
    const identity = `${field.entityType}:${field.key}`
    declared.add(identity)
    const existingField = existingByIdentity.get(identity)
    if (!existingField) {
      await options.customFields.createForOwner(db, owner, field)
      continue
    }
    if (existingField.fieldType !== field.fieldType) {
      throw new ApiHttpError("Custom-field type is immutable once installed", {
        status: 409,
        code: "app_custom_field_immutable_type",
      })
    }
    if (field.isRequired && !existingField.isRequired) {
      throw new ApiHttpError("Custom-field tightening requires migration validation", {
        status: 409,
        code: "app_custom_field_tightening_requires_validation",
      })
    }
    await options.customFields.updateForOwner(db, owner, existingField.id, {
      label: field.label,
      isRequired: field.isRequired,
      isSearchable: field.isSearchable,
      isExportable: field.isExportable,
      isInvoiceable: field.isInvoiceable,
      options: field.options,
    })
  }
  for (const [identity, definition] of existingByIdentity) {
    if (!declared.has(identity)) {
      await db
        .update(customFieldDefinitions)
        .set({ lifecycleState: "deprecated", updatedAt: new Date() })
        .where(eq(customFieldDefinitions.id, definition.id))
    }
  }
}

function parseNormalizedRelease(value: unknown): NormalizedAppReleaseRecord {
  if (!isNormalizedRelease(value)) {
    throw new ApiHttpError("Stored app release manifest is not a normalized app release", {
      status: 500,
      code: "app_release_normalized_record_invalid",
    })
  }
  return value
}

function isNormalizedRelease(value: unknown): value is NormalizedAppReleaseRecord {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    record.schemaVersion === "voyant.app-release.normalized.v1" &&
    typeof record.releaseVersion === "string" &&
    typeof record.digest === "string" &&
    Array.isArray(record.requestedScopes) &&
    Array.isArray(record.optionalScopes) &&
    Array.isArray(record.adminPages) &&
    Array.isArray(record.slotExtensions) &&
    Array.isArray(record.webhooks) &&
    Array.isArray(record.customFields)
  )
}

async function reconcileExtensions(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  release: AppRelease,
  normalized: NormalizedAppReleaseRecord,
) {
  for (const page of normalized.adminPages) {
    await upsertExtension(db, installation, release, `page:${page.key}`, page)
  }
  for (const extension of normalized.slotExtensions) {
    await upsertExtension(db, installation, release, `slot:${extension.key}`, extension)
  }
}

async function upsertExtension(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  release: AppRelease,
  extensionKey: string,
  descriptor: Record<string, unknown>,
) {
  await db
    .insert(appExtensionInstallations)
    .values({
      installationId: installation.id,
      releaseId: release.id,
      extensionKey,
      descriptor,
      status: "active",
      deactivatedAt: null,
    })
    .onConflictDoUpdate({
      target: [appExtensionInstallations.installationId, appExtensionInstallations.extensionKey],
      set: { releaseId: release.id, descriptor, status: "active", deactivatedAt: null },
    })
}

async function reconcileWebhooks(
  db: PostgresJsDatabase,
  installation: AppInstallation,
  release: AppRelease,
  normalized: NormalizedAppReleaseRecord,
) {
  for (const webhook of normalized.webhooks) {
    await db
      .insert(appWebhookSubscriptions)
      .values({
        installationId: installation.id,
        releaseId: release.id,
        eventType: webhook.eventType,
        eventVersion: webhook.eventVersion,
        endpointUrl: webhook.endpointUrl,
        status: "active",
        failureCount: 0,
        pausedAt: null,
        deactivatedAt: null,
      })
      .onConflictDoUpdate({
        target: [
          appWebhookSubscriptions.installationId,
          appWebhookSubscriptions.eventType,
          appWebhookSubscriptions.eventVersion,
          appWebhookSubscriptions.endpointUrl,
        ],
        set: {
          releaseId: release.id,
          status: "active",
          failureCount: 0,
          pausedAt: null,
          deactivatedAt: null,
        },
      })
  }
}
