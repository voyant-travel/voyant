import { randomBytes } from "node:crypto"
import { ApiHttpError } from "@voyant-travel/hono"
import { and, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { type CompileAppManifestOptions, compileAppManifest } from "./compiler.js"
import type {
  AppListQuery,
  CreateCustomAppRegistrationInput,
  ReleaseManifestFetchInput,
  ReleaseManifestUploadInput,
} from "./contracts.js"
import { fetchProtectedManifest, type ManifestFetchOptions } from "./ingestion.js"
import {
  appRedirectUris,
  appReleaseArtifacts,
  appReleaseLocalizations,
  appReleases,
  apps,
} from "./schema.js"

export interface AppsServiceOptions extends CompileAppManifestOptions {
  fetch?: ManifestFetchOptions["fetch"]
  resolveHost?: ManifestFetchOptions["resolveHost"]
}

export function createAppsService(options: AppsServiceOptions = {}) {
  async function createCustomApp(db: PostgresJsDatabase, input: CreateCustomAppRegistrationInput) {
    return db.transaction(async (tx) => {
      const app = await insertRegistrationWithNamespace(tx, input)
      if (input.redirectUris.length > 0) {
        await tx
          .insert(appRedirectUris)
          .values(
            input.redirectUris.map((redirectUri) => ({
              appId: app.id,
              redirectUri,
            })),
          )
          .returning({ id: appRedirectUris.id })
      }
      return app
    })
  }

  async function list(db: PostgresJsDatabase, query: AppListQuery) {
    const where = and(
      query.ownerId ? eq(apps.ownerId, query.ownerId) : undefined,
      query.distribution ? eq(apps.distribution, query.distribution) : undefined,
    )
    const [data, count] = await Promise.all([
      db
        .select()
        .from(apps)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(apps.createdAt),
      db.select({ count: sql<number>`count(*)::int` }).from(apps).where(where),
    ])
    return { data, total: count[0]?.count ?? 0, limit: query.limit, offset: query.offset }
  }

  async function get(db: PostgresJsDatabase, appId: string) {
    const [row] = await db.select().from(apps).where(eq(apps.id, appId)).limit(1)
    return row ?? null
  }

  async function releaseFromUpload(
    db: PostgresJsDatabase,
    appId: string,
    input: ReleaseManifestUploadInput,
  ) {
    const compiled = compileAppManifest(input.manifest, options)
    return createRelease(db, appId, {
      createdBy: input.createdBy,
      compiled,
      artifactProvenance: input.provenance,
    })
  }

  async function releaseFromFetch(
    db: PostgresJsDatabase,
    appId: string,
    input: ReleaseManifestFetchInput,
  ) {
    const fetched = await fetchProtectedManifest(input.manifestUrl, {
      fetch: options.fetch,
      resolveHost: options.resolveHost,
    })
    const compiled = compileAppManifest(fetched.body, options)
    return createRelease(db, appId, {
      createdBy: input.createdBy,
      compiled,
      artifactProvenance: {
        source: "https-manifest",
        url: fetched.url,
        contentType: fetched.contentType,
        bytes: fetched.bytes,
      },
    })
  }

  return { createCustomApp, list, get, releaseFromUpload, releaseFromFetch }
}

async function insertRegistrationWithNamespace(
  db: PostgresJsDatabase,
  input: CreateCustomAppRegistrationInput,
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const [row] = await db
      .insert(apps)
      .values({
        ownerId: input.ownerId,
        displayName: input.displayName,
        slug: input.slug,
        createdBy: input.createdBy,
        distribution: "custom",
        platformNamespace: `app--${randomBytes(10).toString("hex")}`,
      })
      .onConflictDoNothing({ target: apps.platformNamespace })
      .returning()
    if (row) return row
  }
  throw new ApiHttpError("Could not assign a unique app namespace", {
    status: 500,
    code: "app_namespace_assignment_failed",
  })
}

async function createRelease(
  db: PostgresJsDatabase,
  appId: string,
  input: {
    createdBy: string
    compiled: ReturnType<typeof compileAppManifest>
    artifactProvenance: Record<string, unknown>
  },
) {
  return db.transaction(async (tx) => {
    const existingApp = await selectAppForUpdate(tx, appId)
    if (!existingApp) {
      throw new ApiHttpError("App registration not found", { status: 404, code: "app_not_found" })
    }
    const releaseVersion = input.compiled.manifest.releaseVersion
    const versionRow = await selectReleaseByVersion(tx, appId, releaseVersion)
    if (
      versionRow &&
      versionRow.releaseVersion === releaseVersion &&
      versionRow.manifestDigest !== input.compiled.digest
    ) {
      throw new ApiHttpError(
        `Release version ${releaseVersion} already exists with different content; releases are immutable, publish a new version instead`,
        { status: 409, code: "app_release_version_conflict" },
      )
    }
    const manifestSnapshot = JSON.parse(input.compiled.canonicalJson) as Record<string, unknown>
    const normalizedRecord: Record<string, unknown> = JSON.parse(
      JSON.stringify(input.compiled.normalizedRelease),
    )
    const [created] = await tx
      .insert(appReleases)
      .values({
        appId,
        releaseVersion: input.compiled.manifest.releaseVersion,
        manifestSchemaVersion: input.compiled.manifest.schemaVersion,
        manifestDigest: input.compiled.digest,
        manifestSnapshot,
        normalizedRecord,
        apiCompatibility: input.compiled.manifest.apiCompatibility,
        defaultLocale: input.compiled.manifest.locales.default,
        supportedLocales: [...input.compiled.normalizedRelease.supportedLocales],
        createdBy: input.createdBy,
      })
      .onConflictDoNothing({ target: [appReleases.appId, appReleases.manifestDigest] })
      .returning()
    const release = created ?? (await selectReleaseByDigest(tx, appId, input.compiled.digest))
    if (!release) {
      throw new ApiHttpError("Could not resolve app release", {
        status: 500,
        code: "app_release_create_failed",
      })
    }
    if (created) {
      await tx
        .insert(appReleaseArtifacts)
        .values({
          releaseId: created.id,
          digest: input.compiled.digest,
          signature: null,
          provenance: input.artifactProvenance,
          registryCoordinates: null,
          assetInventory: { files: [] },
        })
        .returning({ id: appReleaseArtifacts.id })
      if (input.compiled.normalizedRelease.localizations.length > 0) {
        await tx
          .insert(appReleaseLocalizations)
          .values(
            input.compiled.normalizedRelease.localizations.map((localization) => ({
              releaseId: created.id,
              ...localization,
            })),
          )
          .returning({ id: appReleaseLocalizations.id })
      }
    }
    return { release, created: Boolean(created), digest: input.compiled.digest }
  })
}

async function selectAppForUpdate(db: PostgresJsDatabase, appId: string) {
  const [row] = await db.select().from(apps).where(eq(apps.id, appId)).for("update").limit(1)
  return row ?? null
}

async function selectReleaseByVersion(db: PostgresJsDatabase, appId: string, version: string) {
  const [row] = await db
    .select()
    .from(appReleases)
    .where(and(eq(appReleases.appId, appId), eq(appReleases.releaseVersion, version)))
    .limit(1)
  return row ?? null
}

async function selectReleaseByDigest(db: PostgresJsDatabase, appId: string, digest: string) {
  const [row] = await db
    .select()
    .from(appReleases)
    .where(and(eq(appReleases.appId, appId), eq(appReleases.manifestDigest, digest)))
    .limit(1)
  return row ?? null
}
