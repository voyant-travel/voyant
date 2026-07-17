import { typeId } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import {
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

export type AppRegistration = typeof apps.$inferSelect
export type NewAppRegistration = typeof apps.$inferInsert
export type AppRelease = typeof appReleases.$inferSelect
export type NewAppRelease = typeof appReleases.$inferInsert
