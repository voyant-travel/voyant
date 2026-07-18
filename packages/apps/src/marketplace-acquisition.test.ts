import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { compileAppManifest } from "./compiler.js"
import { createAppInstallationService } from "./installation-service.js"
import {
  createMarketplaceAcquisitionService,
  type HostVerifiedMarketplaceAcquisition,
  marketplaceSetupAssertionClaimsSchema,
} from "./marketplace-acquisition.js"
import { appRedirectUris, appReleaseArtifacts, appReleases, apps } from "./schema.js"
import { validManifest } from "./test-fixtures.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

function acquisition(
  overrides: Partial<HostVerifiedMarketplaceAcquisition> = {},
): HostVerifiedMarketplaceAcquisition {
  const digest = compileAppManifest(validManifest).digest
  return {
    schemaVersion: "voyant.runtime-marketplace-acquisition.v1",
    acquisitionId: "acquisition_1",
    app: {
      id: "marketplace_app_1",
      ownerId: "publisher_1",
      displayName: "Accounting Bridge",
      slug: "accounting-bridge",
      redirectUris: ["https://app.example.com/oauth/callback"],
    },
    release: {
      id: "marketplace_release_1",
      manifest: validManifest,
      digest,
      signature: "host-verified-signature",
      provenance: { publisherId: "publisher_1", reviewId: "review_1" },
      assetInventory: { files: [] },
    },
    ...overrides,
  }
}

describe("Marketplace setup assertion contract", () => {
  const valid = {
    schemaVersion: "voyant.marketplace-setup-assertion.v1",
    iss: "https://cloud.example.com",
    aud: "marketplace_app_1",
    sub: "installation_1",
    jti: "setup_nonce_1",
    iat: 1_000,
    exp: 1_300,
    installationId: "installation_1",
    appId: "marketplace_app_1",
    releaseId: "marketplace_release_1",
    authorizationUrl: "https://admin.example.com/api/v1/admin/apps/oauth/authorize",
    tokenUrl: "https://admin.example.com/api/v1/admin/apps/oauth/token",
    redirectUri: "https://app.example.com/oauth/callback",
  } as const

  it("binds subject, audience, identity, exact OAuth coordinates, and a five-minute lifetime", () => {
    expect(marketplaceSetupAssertionClaimsSchema.parse(valid)).toEqual(valid)
    expect(() =>
      marketplaceSetupAssertionClaimsSchema.parse({ ...valid, sub: "another_installation" }),
    ).toThrow(/subject/i)
    expect(() =>
      marketplaceSetupAssertionClaimsSchema.parse({ ...valid, aud: "another_app" }),
    ).toThrow(/audience/i)
    expect(() => marketplaceSetupAssertionClaimsSchema.parse({ ...valid, exp: 1_301 })).toThrow(
      /300 seconds/i,
    )
  })

  it("rejects non-HTTPS coordinates", () => {
    expect(() =>
      marketplaceSetupAssertionClaimsSchema.parse({
        ...valid,
        tokenUrl: "http://admin.example.com/api/v1/admin/apps/oauth/token",
      }),
    ).toThrow(/HTTPS/i)
  })
})

describe.skipIf(!DB_AVAILABLE)("managed Marketplace acquisition", () => {
  let db: PostgresJsDatabase

  beforeAll(async () => {
    const { createTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  it("idempotently admits a host-verified app and immutable available release", async () => {
    const current = acquisition()
    const resolveAcquisitionIntent = vi.fn(async () => current)
    const service = createMarketplaceAcquisitionService({
      resolveAcquisitionIntent,
      createSetupHandoff: vi.fn(),
    })

    const first = await service.resolveAndAcquire(db, { intent: "opaque-1", actorId: "user_1" })
    const second = await service.resolveAndAcquire(db, { intent: "opaque-1", actorId: "user_1" })

    expect(first).toMatchObject({
      appId: current.app.id,
      releaseId: current.release.id,
      acquisitionId: current.acquisitionId,
      created: true,
    })
    expect(second).toMatchObject({ created: false })
    expect(resolveAcquisitionIntent).toHaveBeenNthCalledWith(1, { intent: "opaque-1" })

    const [app] = await db.select().from(apps).where(eq(apps.id, current.app.id))
    const releases = await db
      .select()
      .from(appReleases)
      .where(eq(appReleases.appId, current.app.id))
    const artifacts = await db
      .select()
      .from(appReleaseArtifacts)
      .where(eq(appReleaseArtifacts.releaseId, current.release.id))
    const redirects = await db
      .select()
      .from(appRedirectUris)
      .where(eq(appRedirectUris.appId, current.app.id))
    expect(app).toMatchObject({
      distribution: "marketplace",
      ownerId: current.app.ownerId,
      displayName: current.app.displayName,
    })
    expect(releases).toHaveLength(1)
    expect(releases[0]).toMatchObject({
      state: "available",
      manifestDigest: current.release.digest,
    })
    expect(artifacts).toHaveLength(1)
    expect(artifacts[0]?.registryCoordinates).toBeNull()
    expect(redirects.map((row) => row.redirectUri)).toEqual(current.app.redirectUris)

    current.release.signature = "different-signature"
    await expect(
      service.resolveAndAcquire(db, { intent: "opaque-1", actorId: "user_1" }),
    ).rejects.toMatchObject({ status: 409, code: "app_marketplace_identity_conflict" })
  })

  it("rejects a digest that does not match the independently compiled manifest", async () => {
    const service = createMarketplaceAcquisitionService({
      resolveAcquisitionIntent: async () =>
        acquisition({ release: { ...acquisition().release, digest: `sha256:${"0".repeat(64)}` } }),
      createSetupHandoff: vi.fn(),
    })

    await expect(
      service.resolveAndAcquire(db, { intent: "opaque-1", actorId: "user_1" }),
    ).rejects.toMatchObject({ status: 409, code: "app_marketplace_digest_mismatch" })
  })

  it("creates setup only from active installation identity and an admitted setup origin", async () => {
    const current = acquisition()
    const createSetupHandoff = vi.fn(async () => ({
      redirectUrl: "https://app.example.com/setup?code=one-time-opaque",
    }))
    const service = createMarketplaceAcquisitionService({
      resolveAcquisitionIntent: async () => current,
      createSetupHandoff,
    })
    await service.resolveAndAcquire(db, { intent: "opaque-1", actorId: "user_1" })
    const installed = await createAppInstallationService({ deploymentId: "deployment_1" }).install(
      db,
      {
        appId: current.app.id,
        releaseId: current.release.id,
        actorId: "user_1",
      },
    )

    await expect(service.createSetupHandoff(db, installed.installation.id)).resolves.toEqual({
      redirectUrl: "https://app.example.com/setup?code=one-time-opaque",
    })
    expect(createSetupHandoff).toHaveBeenCalledWith({
      installationId: installed.installation.id,
      appId: current.app.id,
      releaseId: current.release.id,
    })

    createSetupHandoff.mockResolvedValueOnce({
      redirectUrl: "https://attacker.example/setup?code=stolen",
    })
    await expect(service.createSetupHandoff(db, installed.installation.id)).rejects.toMatchObject({
      status: 502,
      code: "app_marketplace_setup_invalid",
    })
  })
})
