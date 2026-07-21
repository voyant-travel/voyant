import { randomBytes } from "node:crypto"
import { ApiHttpError } from "@voyant-travel/hono"
import { and, eq, isNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { z } from "zod"
import {
  type CompileAppManifestOptions,
  canonicalJsonStringify,
  compileAppManifest,
} from "./compiler.js"
import {
  type AppInstallation,
  appCredentials,
  appInstallations,
  appRedirectUris,
  appReleaseArtifacts,
  appReleaseLocalizations,
  appReleases,
  apps,
} from "./schema.js"

const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", "URL must use HTTPS.")

/**
 * Provider-neutral, host-verified input to the deployment-local app registry.
 * A managed host adapts its private catalog model to this closed contract only
 * after it has authenticated the deployment and verified artifact provenance.
 */
export const hostVerifiedMarketplaceAcquisitionSchema = z
  .object({
    schemaVersion: z.literal("voyant.runtime-marketplace-acquisition.v1"),
    acquisitionId: z.string().trim().min(1).max(200),
    app: z
      .object({
        id: z.string().trim().min(1).max(200),
        ownerId: z.string().trim().min(1).max(200),
        displayName: z.string().trim().min(1).max(120),
        slug: z
          .string()
          .trim()
          .regex(/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/),
        redirectUris: z.array(httpsUrlSchema).max(20),
        oauthClient: z
          .object({
            method: z.literal("client_secret_post"),
            /** Verifier for a high-entropy publisher-held secret; never the raw secret. */
            secretSha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      })
      .strict(),
    release: z
      .object({
        id: z.string().trim().min(1).max(200),
        manifest: z.unknown(),
        digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
        signature: z.string().trim().min(1).max(16_384).optional(),
        provenance: z.record(z.string(), z.unknown()),
        assetInventory: z.record(z.string(), z.unknown()).default({ files: [] }),
      })
      .strict(),
  })
  .strict()

export type HostVerifiedMarketplaceAcquisition = z.infer<
  typeof hostVerifiedMarketplaceAcquisitionSchema
>

export const resolveMarketplaceInstallIntentSchema = z
  .object({ intent: z.string().trim().min(1).max(2048) })
  .strict()

export const marketplaceInstallIntentResultSchema = z.object({
  data: z
    .object({
      appId: z.string(),
      releaseId: z.string(),
      acquisitionId: z.string(),
      created: z.boolean(),
      existingInstallation: z
        .object({
          id: z.string(),
          releaseId: z.string(),
          status: z.enum([
            "pending",
            "authorizing",
            "active",
            "paused",
            "degraded",
            "revoked",
            "uninstalled",
          ]),
        })
        .strict()
        .nullable(),
    })
    .strict(),
})

export const marketplaceSetupHandoffResultSchema = z.object({
  data: z.object({ redirectUrl: httpsUrlSchema }).strict(),
})

export const MARKETPLACE_SETUP_ASSERTION_TYPE = "voyant-marketplace-setup+jwt" as const

/** Claims signed by the managed host and verified by the remote app backend. */
export const marketplaceSetupAssertionClaimsSchema = z
  .object({
    schemaVersion: z.literal("voyant.marketplace-setup-assertion.v1"),
    iss: z.string().trim().min(1),
    aud: z.string().trim().min(1),
    sub: z.string().trim().min(1),
    jti: z.string().trim().min(1).max(200),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
    installationId: z.string().trim().min(1).max(200),
    appId: z.string().trim().min(1).max(200),
    releaseId: z.string().trim().min(1).max(200),
    authorizationUrl: httpsUrlSchema,
    tokenUrl: httpsUrlSchema,
    redirectUri: httpsUrlSchema,
  })
  .strict()
  .superRefine((claims, context) => {
    if (claims.sub !== claims.installationId) {
      context.addIssue({
        code: "custom",
        path: ["sub"],
        message: "Setup assertion subject must equal installationId.",
      })
    }
    if (claims.aud !== claims.appId) {
      context.addIssue({
        code: "custom",
        path: ["aud"],
        message: "Setup assertion audience must equal appId.",
      })
    }
    if (claims.exp <= claims.iat || claims.exp - claims.iat > 300) {
      context.addIssue({
        code: "custom",
        path: ["exp"],
        message: "Setup assertion lifetime must be positive and no longer than 300 seconds.",
      })
    }
  })

export type MarketplaceSetupAssertionClaims = z.infer<typeof marketplaceSetupAssertionClaimsSchema>

export interface MarketplaceInstallIntentResult {
  appId: string
  releaseId: string
  acquisitionId: string
  created: boolean
  existingInstallation: Pick<AppInstallation, "id" | "releaseId" | "status"> | null
}

export interface MarketplaceAcquisitionServiceOptions extends CompileAppManifestOptions {
  installationIdentity?: {
    deploymentId?: string
    workloadEnvironmentId?: string
  }
  resolveAcquisitionIntent(input: {
    intent: string
  }): Promise<HostVerifiedMarketplaceAcquisition | null>
  createSetupHandoff(input: {
    installationId: string
    appId: string
    releaseId: string
  }): Promise<{ redirectUrl: string }>
}

export function createMarketplaceAcquisitionService(options: MarketplaceAcquisitionServiceOptions) {
  return {
    async resolveAndAcquire(
      db: PostgresJsDatabase,
      input: { intent: string; actorId: string },
    ): Promise<MarketplaceInstallIntentResult> {
      const raw = await options.resolveAcquisitionIntent({ intent: input.intent })
      if (!raw) {
        throw new ApiHttpError("Marketplace install intent was not found or has expired", {
          status: 404,
          code: "app_marketplace_intent_unavailable",
        })
      }
      const acquisition = hostVerifiedMarketplaceAcquisitionSchema.parse(raw)
      const compiled = compileAppManifest(acquisition.release.manifest, options)
      if (compiled.digest !== acquisition.release.digest) {
        throw new ApiHttpError("Marketplace release digest verification failed", {
          status: 409,
          code: "app_marketplace_digest_mismatch",
        })
      }

      return db.transaction(async (tx) => {
        const app = await acquireApp(tx, acquisition, input.actorId)
        await reconcileOAuthClient(tx, app.id, acquisition.app.oauthClient.secretSha256)
        await reconcileRedirectUris(tx, app.id, acquisition.app.redirectUris)
        const release = await acquireRelease(tx, acquisition, compiled, input.actorId)
        const existingInstallation = await selectExistingInstallation(
          tx,
          app.id,
          options.installationIdentity,
        )
        return {
          appId: app.id,
          releaseId: release.id,
          acquisitionId: acquisition.acquisitionId,
          created: release.created,
          existingInstallation,
        }
      })
    },

    async createSetupHandoff(db: PostgresJsDatabase, installationId: string) {
      const [row] = await db
        .select({
          installationId: appInstallations.id,
          appId: apps.id,
          releaseId: appReleases.id,
          distribution: apps.distribution,
          status: appInstallations.status,
          normalizedRecord: appReleases.normalizedRecord,
        })
        .from(appInstallations)
        .innerJoin(apps, eq(apps.id, appInstallations.appId))
        .innerJoin(appReleases, eq(appReleases.id, appInstallations.releaseId))
        .where(eq(appInstallations.id, installationId))
        .limit(1)
      if (row?.distribution !== "marketplace" || row.status !== "active") {
        throw new ApiHttpError("Active Marketplace installation not found", {
          status: 404,
          code: "app_marketplace_installation_not_found",
        })
      }
      const setupUrl = readSetupUrl(row.normalizedRecord)
      if (!setupUrl) {
        throw new ApiHttpError("This app release has no setup handoff", {
          status: 409,
          code: "app_marketplace_setup_unavailable",
        })
      }
      const handoff = await options.createSetupHandoff({
        installationId: row.installationId,
        appId: row.appId,
        releaseId: row.releaseId,
      })
      const redirectUrl = parseTrustedSetupRedirect(handoff.redirectUrl, setupUrl)
      return { redirectUrl }
    },
  }
}

async function selectExistingInstallation(
  db: PostgresJsDatabase,
  appId: string,
  identity: MarketplaceAcquisitionServiceOptions["installationIdentity"],
): Promise<Pick<AppInstallation, "id" | "releaseId" | "status"> | null> {
  const binding = identity?.workloadEnvironmentId
    ? eq(appInstallations.workloadEnvironmentId, identity.workloadEnvironmentId)
    : identity?.deploymentId
      ? eq(appInstallations.deploymentId, identity.deploymentId)
      : null
  if (!binding) return null
  const [installation] = await db
    .select({
      id: appInstallations.id,
      releaseId: appInstallations.releaseId,
      status: appInstallations.status,
    })
    .from(appInstallations)
    .where(and(eq(appInstallations.appId, appId), binding))
    .limit(1)
  return installation ?? null
}

async function acquireApp(
  db: PostgresJsDatabase,
  acquisition: HostVerifiedMarketplaceAcquisition,
  actorId: string,
) {
  const existing = await selectAppForUpdate(db, acquisition.app.id)
  if (existing) {
    if (existing.distribution !== "marketplace" || existing.ownerId !== acquisition.app.ownerId) {
      throw immutableIdentityConflict("Marketplace app identity conflicts with the local registry")
    }
    const [updated] = await db
      .update(apps)
      .set({
        displayName: acquisition.app.displayName,
        slug: acquisition.app.slug,
        lifecycleState: "active",
        updatedAt: new Date(),
      })
      .where(eq(apps.id, existing.id))
      .returning()
    return updated ?? existing
  }

  const [created] = await db
    .insert(apps)
    .values({
      id: acquisition.app.id,
      ownerId: acquisition.app.ownerId,
      displayName: acquisition.app.displayName,
      slug: acquisition.app.slug,
      distribution: "marketplace",
      platformNamespace: `app--${randomBytes(10).toString("hex")}`,
      createdBy: actorId,
    })
    .onConflictDoNothing()
    .returning()
  const row = created ?? (await selectAppForUpdate(db, acquisition.app.id))
  if (row?.distribution !== "marketplace" || row.ownerId !== acquisition.app.ownerId) {
    throw immutableIdentityConflict("Marketplace app identity could not be admitted")
  }
  return row
}

async function reconcileOAuthClient(db: PostgresJsDatabase, appId: string, secretSha256: string) {
  const expectedVerifier = `sha256:${secretSha256}`
  const [active] = await db
    .select()
    .from(appCredentials)
    .where(
      and(
        eq(appCredentials.appId, appId),
        eq(appCredentials.kind, "client_secret"),
        isNull(appCredentials.retiredAt),
      ),
    )
    .limit(1)
  if (active) {
    if (active.kmsKeyRef !== expectedVerifier) {
      throw immutableIdentityConflict(
        "Marketplace OAuth client verifier conflicts with the admitted app",
      )
    }
    return
  }

  const generations = await db
    .select({ generation: appCredentials.generation })
    .from(appCredentials)
    .where(and(eq(appCredentials.appId, appId), eq(appCredentials.kind, "client_secret")))
  await db.insert(appCredentials).values({
    appId,
    kind: "client_secret",
    generation: Math.max(0, ...generations.map((credential) => credential.generation)) + 1,
    kmsKeyRef: expectedVerifier,
  })
}

async function reconcileRedirectUris(
  db: PostgresJsDatabase,
  appId: string,
  redirectUris: readonly string[],
) {
  const desired = [...new Set(redirectUris)].sort()
  const current = await db
    .select({ redirectUri: appRedirectUris.redirectUri })
    .from(appRedirectUris)
    .where(eq(appRedirectUris.appId, appId))
  const present = current.map((row) => row.redirectUri).sort()
  if (JSON.stringify(present) === JSON.stringify(desired)) return
  await db.delete(appRedirectUris).where(eq(appRedirectUris.appId, appId))
  if (desired.length > 0) {
    await db.insert(appRedirectUris).values(desired.map((redirectUri) => ({ appId, redirectUri })))
  }
}

async function acquireRelease(
  db: PostgresJsDatabase,
  acquisition: HostVerifiedMarketplaceAcquisition,
  compiled: ReturnType<typeof compileAppManifest>,
  actorId: string,
) {
  const byId = await selectReleaseByIdForUpdate(db, acquisition.release.id)
  const byVersion = await selectReleaseByVersion(
    db,
    acquisition.app.id,
    compiled.manifest.releaseVersion,
  )
  const byDigest = await selectReleaseByDigest(db, acquisition.app.id, compiled.digest)
  for (const existing of [byId, byVersion, byDigest]) {
    if (
      existing &&
      (existing.id !== acquisition.release.id ||
        existing.appId !== acquisition.app.id ||
        existing.releaseVersion !== compiled.manifest.releaseVersion ||
        existing.manifestDigest !== compiled.digest)
    ) {
      throw immutableIdentityConflict(
        "Marketplace release identity conflicts with an immutable local release",
      )
    }
  }

  const existing = byId ?? byVersion ?? byDigest
  if (existing) {
    if (existing.state !== "available") {
      throw new ApiHttpError("Marketplace release is not locally available", {
        status: 409,
        code: "app_marketplace_release_unavailable",
      })
    }
    if (canonicalJsonStringify(existing.manifestSnapshot) !== compiled.canonicalJson) {
      throw immutableIdentityConflict(
        "Marketplace release snapshot conflicts with the admitted manifest",
      )
    }
    const [artifact] = await db
      .select()
      .from(appReleaseArtifacts)
      .where(eq(appReleaseArtifacts.releaseId, existing.id))
      .limit(1)
    const expectedProvenance = marketplaceArtifactProvenance(acquisition)
    if (
      artifact?.digest !== compiled.digest ||
      artifact.state !== "available" ||
      artifact.signature !== (acquisition.release.signature ?? null) ||
      canonicalJsonStringify(artifact.provenance) !== canonicalJsonStringify(expectedProvenance) ||
      canonicalJsonStringify(artifact.assetInventory) !==
        canonicalJsonStringify(acquisition.release.assetInventory)
    ) {
      throw immutableIdentityConflict(
        "Marketplace release artifact conflicts with the admitted manifest",
      )
    }
    return { ...existing, created: false }
  }

  const manifestSnapshot = JSON.parse(compiled.canonicalJson) as Record<string, unknown>
  const normalizedRecord = JSON.parse(JSON.stringify(compiled.normalizedRelease)) as Record<
    string,
    unknown
  >
  const [created] = await db
    .insert(appReleases)
    .values({
      id: acquisition.release.id,
      appId: acquisition.app.id,
      releaseVersion: compiled.manifest.releaseVersion,
      manifestSchemaVersion: compiled.manifest.schemaVersion,
      manifestDigest: compiled.digest,
      manifestSnapshot,
      normalizedRecord,
      apiCompatibility: compiled.manifest.apiCompatibility,
      defaultLocale: compiled.manifest.locales.default,
      supportedLocales: [...compiled.normalizedRelease.supportedLocales],
      state: "available",
      createdBy: actorId,
    })
    .returning()
  if (!created) {
    throw new ApiHttpError("Marketplace release could not be admitted", {
      status: 500,
      code: "app_marketplace_release_write_failed",
    })
  }
  await db.insert(appReleaseArtifacts).values({
    releaseId: created.id,
    digest: compiled.digest,
    signature: acquisition.release.signature ?? null,
    provenance: marketplaceArtifactProvenance(acquisition),
    registryCoordinates: null,
    assetInventory: acquisition.release.assetInventory,
    state: "available",
  })
  if (compiled.normalizedRelease.localizations.length > 0) {
    await db.insert(appReleaseLocalizations).values(
      compiled.normalizedRelease.localizations.map((localization) => ({
        releaseId: created.id,
        ...localization,
      })),
    )
  }
  return { ...created, created: true }
}

function marketplaceArtifactProvenance(acquisition: HostVerifiedMarketplaceAcquisition) {
  return {
    ...acquisition.release.provenance,
    acquisitionId: acquisition.acquisitionId,
    source: "managed-marketplace",
  }
}

async function selectAppForUpdate(db: PostgresJsDatabase, appId: string) {
  const [row] = await db.select().from(apps).where(eq(apps.id, appId)).for("update").limit(1)
  return row ?? null
}

async function selectReleaseByIdForUpdate(db: PostgresJsDatabase, releaseId: string) {
  const [row] = await db
    .select()
    .from(appReleases)
    .where(eq(appReleases.id, releaseId))
    .for("update")
    .limit(1)
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

function immutableIdentityConflict(message: string) {
  return new ApiHttpError(message, {
    status: 409,
    code: "app_marketplace_identity_conflict",
  })
}

function readSetupUrl(normalizedRecord: Record<string, unknown>) {
  const urls = normalizedRecord.urls
  if (!urls || typeof urls !== "object" || Array.isArray(urls)) return null
  const setup = (urls as Record<string, unknown>).setup
  if (typeof setup !== "string") return null
  try {
    const parsed = new URL(setup)
    return parsed.protocol === "https:" ? parsed : null
  } catch {
    return null
  }
}

function parseTrustedSetupRedirect(input: string, admittedSetupUrl: URL) {
  let redirect: URL
  try {
    redirect = new URL(input)
  } catch {
    throw new ApiHttpError("Managed setup handoff returned an invalid redirect", {
      status: 502,
      code: "app_marketplace_setup_invalid",
    })
  }
  if (redirect.protocol !== "https:" || redirect.origin !== admittedSetupUrl.origin) {
    throw new ApiHttpError("Managed setup handoff returned an untrusted redirect", {
      status: 502,
      code: "app_marketplace_setup_invalid",
    })
  }
  return redirect.toString()
}
