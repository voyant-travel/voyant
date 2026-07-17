import { typeId } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const appDistributionEnum = pgEnum("app_distribution", ["custom", "marketplace"])
export const appLifecycleStateEnum = pgEnum("app_lifecycle_state", [
  "active",
  "suspended",
  "deleted",
])
export const appCredentialKindEnum = pgEnum("app_credential_kind", ["client_secret", "signing_key"])
export const appReleaseStateEnum = pgEnum("app_release_state", ["available", "suspended", "yanked"])
export const appReleaseArtifactStateEnum = pgEnum("app_release_artifact_state", [
  "available",
  "unavailable",
])
export const appInstallationStatusEnum = pgEnum("app_installation_status", [
  "pending",
  "authorizing",
  "active",
  "paused",
  "degraded",
  "revoked",
  "uninstalled",
])
export const appInstallationUpdatePolicyEnum = pgEnum("app_installation_update_policy", [
  "manual",
  "compatible",
  "patch",
  "pinned",
])
export const appGrantStatusEnum = pgEnum("app_grant_status", [
  "requested",
  "granted",
  "optional",
  "revoked",
])
export const appAccessCredentialStatusEnum = pgEnum("app_access_credential_status", [
  "active",
  "inactive",
  "revoked",
])
export const appInstallationRegistrationStatusEnum = pgEnum(
  "app_installation_registration_status",
  ["active", "inactive"],
)
export const appWebhookSubscriptionStatusEnum = pgEnum("app_webhook_subscription_status", [
  "active",
  "inactive",
  "failed",
])
export const appAuditEventKindEnum = pgEnum("app_audit_event_kind", [
  "lifecycle",
  "grant",
  "credential",
  "reconciliation",
  "purge",
])

export const apps = pgTable(
  "apps",
  {
    id: typeId("apps"),
    platformNamespace: text("platform_namespace").notNull(),
    distribution: appDistributionEnum("distribution").notNull(),
    ownerId: text("owner_id").notNull(),
    displayName: text("display_name").notNull(),
    slug: text("slug").notNull(),
    lifecycleState: appLifecycleStateEnum("lifecycle_state").notNull().default("active"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_apps_platform_namespace").on(table.platformNamespace),
    index("idx_apps_owner").on(table.ownerId, table.distribution, table.lifecycleState),
    // agent-quality: raw-sql reviewed -- owner: apps; identifier is a Drizzle-owned column and the literal prefix is static.
    check("apps_platform_namespace_reserved", sql`${table.platformNamespace} LIKE 'app--%'`),
  ],
)

export const appRedirectUris = pgTable(
  "app_redirect_uris",
  {
    id: typeId("app_redirect_uris"),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_app_redirect_uris_app").on(table.appId),
    uniqueIndex("uidx_app_redirect_uris_exact").on(table.appId, table.redirectUri),
  ],
)

export const appCredentials = pgTable(
  "app_credentials",
  {
    id: typeId("app_credentials"),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    kind: appCredentialKindEnum("kind").notNull(),
    generation: integer("generation").notNull(),
    kmsKeyRef: text("kms_key_ref").notNull(),
    publicKeyRef: text("public_key_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_app_credentials_app").on(table.appId, table.kind),
    uniqueIndex("uidx_app_credentials_generation").on(table.appId, table.kind, table.generation),
  ],
)

export const appReleases = pgTable(
  "app_releases",
  {
    id: typeId("app_releases"),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    releaseVersion: text("release_version").notNull(),
    manifestSchemaVersion: text("manifest_schema_version").notNull(),
    manifestDigest: text("manifest_digest").notNull(),
    manifestSnapshot: jsonb("manifest_snapshot").$type<Record<string, unknown>>().notNull(),
    normalizedRecord: jsonb("normalized_record").$type<Record<string, unknown>>().notNull(),
    apiCompatibility: jsonb("api_compatibility").$type<{ min: string; max: string }>().notNull(),
    defaultLocale: text("default_locale").notNull(),
    supportedLocales: jsonb("supported_locales").$type<string[]>().notNull(),
    state: appReleaseStateEnum("state").notNull().default("available"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_app_releases_app").on(table.appId, table.createdAt),
    uniqueIndex("uidx_app_releases_digest").on(table.appId, table.manifestDigest),
    uniqueIndex("uidx_app_releases_version").on(table.appId, table.releaseVersion),
  ],
)

export const appReleaseArtifacts = pgTable(
  "app_release_artifacts",
  {
    id: typeId("app_release_artifacts"),
    releaseId: text("release_id")
      .notNull()
      .references(() => appReleases.id, { onDelete: "cascade" }),
    digest: text("digest").notNull(),
    signature: text("signature"),
    provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull(),
    registryCoordinates: jsonb("registry_coordinates").$type<Record<string, unknown>>(),
    assetInventory: jsonb("asset_inventory").$type<Record<string, unknown>>().notNull(),
    state: appReleaseArtifactStateEnum("state").notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_app_release_artifacts_release").on(table.releaseId),
    uniqueIndex("uidx_app_release_artifacts_digest").on(table.releaseId, table.digest),
  ],
)

export const appReleaseLocalizations = pgTable(
  "app_release_localizations",
  {
    id: typeId("app_release_localizations"),
    releaseId: text("release_id")
      .notNull()
      .references(() => appReleases.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    surface: text("surface").notNull(),
    messageKey: text("message_key").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_app_release_localizations_release").on(table.releaseId, table.locale),
    uniqueIndex("uidx_app_release_localizations_key").on(
      table.releaseId,
      table.locale,
      table.surface,
      table.messageKey,
    ),
  ],
)

export const appInstallations = pgTable(
  "app_installations",
  {
    id: typeId("app_installations"),
    appId: text("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    deploymentId: text("deployment_id").notNull(),
    releaseId: text("release_id")
      .notNull()
      .references(() => appReleases.id, { onDelete: "restrict" }),
    status: appInstallationStatusEnum("status").notNull().default("pending"),
    namespace: text("namespace").notNull(),
    installedBy: text("installed_by").notNull(),
    updatePolicy: appInstallationUpdatePolicyEnum("update_policy").notNull().default("compatible"),
    lastCompatibleReleaseCheckAt: timestamp("last_compatible_release_check_at", {
      withTimezone: true,
    }),
    pendingReleaseId: text("pending_release_id"),
    pendingReason: text("pending_reason"),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    degradedAt: timestamp("degraded_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_app_installations_app").on(table.appId, table.status),
    index("idx_app_installations_deployment").on(table.deploymentId, table.status),
    uniqueIndex("uidx_app_installations_deployment_app").on(table.deploymentId, table.appId),
    // agent-quality: raw-sql reviewed -- owner: apps; identifier is a Drizzle-owned column and the literal prefix is static.
    check("app_installations_namespace_reserved", sql`${table.namespace} LIKE 'app--%'`),
  ],
)

export const appGrants = pgTable(
  "app_grants",
  {
    id: typeId("app_grants"),
    installationId: text("installation_id")
      .notNull()
      .references(() => appInstallations.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    status: appGrantStatusEnum("status").notNull(),
    optional: boolean("optional").notNull().default(false),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_app_grants_installation").on(table.installationId, table.status),
    uniqueIndex("uidx_app_grants_scope").on(table.installationId, table.scope),
  ],
)

export const appAccessCredentials = pgTable(
  "app_access_credentials",
  {
    id: typeId("app_access_credentials"),
    installationId: text("installation_id")
      .notNull()
      .references(() => appInstallations.id, { onDelete: "cascade" }),
    generation: integer("generation").notNull(),
    credentialHash: text("credential_hash").notNull(),
    encryptedMetadata: jsonb("encrypted_metadata").$type<Record<string, unknown>>().notNull(),
    status: appAccessCredentialStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_app_access_credentials_installation").on(table.installationId, table.status),
    uniqueIndex("uidx_app_access_credentials_generation").on(
      table.installationId,
      table.generation,
    ),
  ],
)

export const appInstallationSettings = pgTable(
  "app_installation_settings",
  {
    id: typeId("app_installation_settings"),
    installationId: text("installation_id")
      .notNull()
      .references(() => appInstallations.id, { onDelete: "cascade" }),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull(),
    schemaDigest: text("schema_digest").notNull(),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uidx_app_installation_settings_installation").on(table.installationId)],
)

export const appSecretReferences = pgTable(
  "app_secret_references",
  {
    id: typeId("app_secret_references"),
    installationId: text("installation_id")
      .notNull()
      .references(() => appInstallations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    secretRef: text("secret_ref").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("uidx_app_secret_references_key").on(table.installationId, table.key)],
)

export const appExtensionInstallations = pgTable(
  "app_extension_installations",
  {
    id: typeId("app_extension_installations"),
    installationId: text("installation_id")
      .notNull()
      .references(() => appInstallations.id, { onDelete: "cascade" }),
    releaseId: text("release_id")
      .notNull()
      .references(() => appReleases.id, { onDelete: "cascade" }),
    extensionKey: text("extension_key").notNull(),
    descriptor: jsonb("descriptor").$type<Record<string, unknown>>().notNull(),
    status: appInstallationRegistrationStatusEnum("status").notNull().default("active"),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_app_extension_installations_installation").on(table.installationId, table.status),
    uniqueIndex("uidx_app_extension_installations_key").on(
      table.installationId,
      table.extensionKey,
    ),
  ],
)

export const appWebhookSubscriptions = pgTable(
  "app_webhook_subscriptions",
  {
    id: typeId("app_webhook_subscriptions"),
    installationId: text("installation_id")
      .notNull()
      .references(() => appInstallations.id, { onDelete: "cascade" }),
    releaseId: text("release_id")
      .notNull()
      .references(() => appReleases.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    eventVersion: text("event_version").notNull(),
    endpointUrl: text("endpoint_url").notNull(),
    status: appWebhookSubscriptionStatusEnum("status").notNull().default("active"),
    externalSubscriptionId: text("external_subscription_id"),
    signingKeyId: text("signing_key_id"),
    lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_app_webhook_subscriptions_installation").on(table.installationId, table.status),
    uniqueIndex("uidx_app_webhook_subscriptions_event").on(
      table.installationId,
      table.eventType,
      table.eventVersion,
      table.endpointUrl,
    ),
  ],
)

export const appAuditEvents = pgTable(
  "app_audit_events",
  {
    id: typeId("app_audit_events"),
    installationId: text("installation_id").references(() => appInstallations.id, {
      onDelete: "set null",
    }),
    appId: text("app_id").notNull(),
    deploymentId: text("deployment_id").notNull(),
    actorId: text("actor_id").notNull(),
    kind: appAuditEventKindEnum("kind").notNull(),
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_app_audit_events_installation").on(table.installationId, table.createdAt),
    index("idx_app_audit_events_app").on(table.appId, table.deploymentId, table.createdAt),
  ],
)

export type AppRegistration = typeof apps.$inferSelect
export type NewAppRegistration = typeof apps.$inferInsert
export type AppRelease = typeof appReleases.$inferSelect
export type NewAppRelease = typeof appReleases.$inferInsert
export type AppInstallation = typeof appInstallations.$inferSelect
export type NewAppInstallation = typeof appInstallations.$inferInsert
