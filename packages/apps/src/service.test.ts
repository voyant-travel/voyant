import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"
import {
  appRedirectUris,
  appReleaseArtifacts,
  appReleaseLocalizations,
  appReleases,
  apps,
} from "./schema.js"
import { createAppsService } from "./service.js"
import { validManifest } from "./test-fixtures.js"

function postgresStub(implementation: object): PostgresJsDatabase {
  const db = Object.create(null) as PostgresJsDatabase
  Object.assign(db, implementation)
  if (!("transaction" in db)) {
    Object.assign(db, {
      transaction: async (callback: (tx: PostgresJsDatabase) => unknown) => callback(db),
    })
  }
  return db
}

function createRegistryDb() {
  const rows = {
    apps: [] as Record<string, unknown>[],
    releases: [] as Record<string, unknown>[],
    artifacts: [] as Record<string, unknown>[],
    localizations: [] as Record<string, unknown>[],
    redirectUris: [] as Record<string, unknown>[],
  }
  let appSequence = 0
  let releaseSequence = 0
  const db = postgresStub({
    insert: (table: unknown) => ({
      values: (value: Record<string, unknown> | Record<string, unknown>[]) => {
        const values = Array.isArray(value) ? value : [value]
        const insertRows = () => {
          if (table === apps) {
            const row = { id: `app_${++appSequence}`, ...values[0] }
            if (
              rows.apps.some(
                (existing) =>
                  existing.platformNamespace === (row as Record<string, unknown>).platformNamespace,
              )
            ) {
              return []
            }
            rows.apps.push(row)
            return [row]
          }
          if (table === appReleases) {
            const row = { id: `release_${++releaseSequence}`, ...values[0] }
            const duplicate = rows.releases.find(
              (existing) =>
                existing.appId === (row as Record<string, unknown>).appId &&
                existing.manifestDigest === (row as Record<string, unknown>).manifestDigest,
            )
            if (duplicate) return []
            rows.releases.push(row)
            return [row]
          }
          if (table === appReleaseArtifacts) rows.artifacts.push(...values)
          if (table === appReleaseLocalizations) rows.localizations.push(...values)
          if (table === appRedirectUris) rows.redirectUris.push(...values)
          return values
        }
        return {
          onConflictDoNothing: () => ({ returning: async () => insertRows() }),
          returning: async () => insertRows(),
        }
      },
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          for: () => ({
            limit: async () => (table === apps ? rows.apps.slice(0, 1) : []),
          }),
          limit: async () => (table === appReleases ? rows.releases.slice(0, 1) : []),
        }),
      }),
    }),
  })
  return { db, rows }
}

describe("apps service", () => {
  it("assigns immutable platform app ids and reserved namespaces independent of names", async () => {
    const { db, rows } = createRegistryDb()
    const service = createAppsService()

    const first = await service.createCustomApp(db, {
      ownerId: "owner_1",
      displayName: "Acme Sync",
      slug: "acme-sync",
      redirectUris: [],
      createdBy: "user_1",
    })
    const second = await service.createCustomApp(db, {
      ownerId: "owner_1",
      displayName: "Acme Sync",
      slug: "acme-sync",
      redirectUris: [],
      createdBy: "user_1",
    })

    expect(first.id).not.toBe(second.id)
    expect(first.platformNamespace).toMatch(/^app--[a-f0-9]+$/)
    expect(second.platformNamespace).toMatch(/^app--[a-f0-9]+$/)
    expect(first.platformNamespace).not.toBe(second.platformNamespace)
    expect(rows.apps).toHaveLength(2)
  })

  it("creates immutable releases and treats the same digest as idempotent", async () => {
    const { db, rows } = createRegistryDb()
    const service = createAppsService()
    const app = await service.createCustomApp(db, {
      ownerId: "owner_1",
      displayName: "Acme Sync",
      slug: "acme-sync",
      redirectUris: [],
      createdBy: "user_1",
    })

    const first = await service.releaseFromUpload(db, app.id, {
      manifest: validManifest,
      createdBy: "user_1",
      provenance: { source: "test" },
    })
    const second = await service.releaseFromUpload(db, app.id, {
      manifest: validManifest,
      createdBy: "user_1",
      provenance: { source: "test" },
    })

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(first.release.id).toBe(second.release.id)
    expect(rows.releases).toHaveLength(1)
    expect(rows.artifacts).toHaveLength(1)
    expect(rows.localizations.length).toBeGreaterThan(0)
    expect(Object.keys(service)).not.toContain("updateRelease")
  })

  it("fetch ingestion stores only the validated snapshot", async () => {
    const { db, rows } = createRegistryDb()
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(validManifest), {
          headers: { "content-type": "application/json" },
        }),
    )
    const service = createAppsService({
      fetch: fetcher as typeof fetch,
      resolveHost: async () => ["203.0.113.10"],
    })
    const app = await service.createCustomApp(db, {
      ownerId: "owner_1",
      displayName: "Acme Sync",
      slug: "acme-sync",
      redirectUris: [],
      createdBy: "user_1",
    })

    await service.releaseFromFetch(db, app.id, {
      manifestUrl: "https://app.example.com/manifest.json",
      createdBy: "user_1",
    })

    expect(rows.releases[0]).toMatchObject({
      appId: app.id,
      manifestSchemaVersion: "voyant.app-manifest.v1",
    })
    expect(rows.releases[0]?.manifestSnapshot).not.toHaveProperty("scripts")
    expect(rows.artifacts[0]?.provenance).toMatchObject({ source: "https-manifest" })
  })
})
