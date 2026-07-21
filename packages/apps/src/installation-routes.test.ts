import { handleApiError } from "@voyant-travel/hono"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { resolveInstalledExtensions } from "./extension-resolution.js"
import { createAppsAdminRoutes } from "./routes.js"
import { apps, appWebhookSubscriptions } from "./schema.js"
import { createAppsService } from "./service.js"
import { validManifest } from "./test-fixtures.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const DEPLOYMENT_ID = "deployment_test"

const json = (body: Record<string, unknown>) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

describe.skipIf(!DB_AVAILABLE)("apps installation admin routes", () => {
  let app: Hono
  let db: PostgresJsDatabase

  beforeAll(async () => {
    const { createTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    app = new Hono()
    app.onError((err, c) => handleApiError(err, c))
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      await next()
    })
    app.route("/", createAppsAdminRoutes({ deploymentId: DEPLOYMENT_ID }))
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  async function seedAppWithReleases() {
    const service = createAppsService()
    const registration = await service.createCustomApp(db, {
      ownerId: "owner_1",
      displayName: "Acme Sync",
      slug: "acme-sync",
      redirectUris: [],
      createdBy: "user_1",
    })
    const v1 = await service.releaseFromUpload(db, registration.id, {
      manifest: validManifest,
      createdBy: "user_1",
      provenance: { source: "test" },
    })
    const v2 = await service.releaseFromUpload(db, registration.id, {
      manifest: {
        ...validManifest,
        releaseVersion: "2.0.0",
        scopes: {
          requested: ["app-webhooks:configure", "bookings:read", "customers:read"],
          optional: ["invoices:read"],
        },
      },
      createdBy: "user_1",
      provenance: { source: "test" },
    })
    return { appId: registration.id, releaseV1: v1.release, releaseV2: v2.release }
  }

  async function installV1(appId: string, releaseId: string) {
    const response = await app.request("/install", json({ appId, releaseId, actorId: "actor_1" }))
    expect(response.status).toBe(201)
    const payload = (await response.json()) as {
      data: { installation: { id: string; status: string } }
    }
    return payload.data.installation
  }

  it("lists installation summaries with joined app + release descriptors", async () => {
    const { appId, releaseV1 } = await seedAppWithReleases()
    await installV1(appId, releaseV1.id)

    const response = await app.request("/installations")
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: Array<Record<string, unknown>>
      total: number
      limit: number
      offset: number
    }
    expect(body.total).toBe(1)
    expect(body.limit).toBe(25)
    expect(body.offset).toBe(0)
    const [summary] = body.data
    expect(summary).toMatchObject({
      appId,
      status: "active",
      appDisplayName: "Acme Sync",
      appSlug: "acme-sync",
      distribution: "custom",
      releaseVersion: "1.0.0",
    })
  })

  it("aggregates installation detail with grants, extensions, webhooks, audit and blocked updates", async () => {
    const { appId, releaseV1, releaseV2 } = await seedAppWithReleases()
    const installation = await installV1(appId, releaseV1.id)

    const response = await app.request(`/installations/${installation.id}`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Record<string, unknown> }
    const detail = body.data as {
      installation: { id: string; status: string }
      app: { id: string }
      activeRelease: { id: string }
      pendingRelease: unknown
      pendingReason: unknown
      grants: Array<{ scope: string; status: string }>
      extensions: Array<{ extensionKey: string }>
      webhooks: { data: Array<{ eventType: string; status: string; signingKeyId: string | null }> }
      recentAudit: Array<{ action: string }>
      availableUpdates: Array<{
        release: { id: string; releaseVersion: string }
        blocked: boolean
        blockedReason: string | null
      }>
    }

    expect(detail.installation.id).toBe(installation.id)
    expect(detail.app.id).toBe(appId)
    expect(detail.activeRelease.id).toBe(releaseV1.id)
    expect(detail.pendingRelease).toBeNull()
    expect(detail.pendingReason).toBeNull()

    // grants are ordered by scope; webhook configuration + bookings are granted.
    expect(detail.grants.map((g) => g.scope)).toEqual([
      "app-webhooks:configure",
      "bookings:read",
      "invoices:read",
    ])
    const bookings = detail.grants.find((g) => g.scope === "bookings:read")
    expect(bookings?.status).toBe("granted")

    expect(detail.extensions.length).toBeGreaterThan(0)
    expect(detail.webhooks.data.map((w) => w.eventType)).toContain("booking.created")
    expect(detail.webhooks.data).toContainEqual(
      expect.objectContaining({
        eventType: "booking.created",
        status: "inactive",
        signingKeyId: null,
      }),
    )
    expect(detail.recentAudit.length).toBeGreaterThan(0)

    // v2 introduces customers:read which was never granted -> blocked
    const v2Update = detail.availableUpdates.find((u) => u.release.id === releaseV2.id)
    expect(v2Update).toBeDefined()
    expect(v2Update?.blocked).toBe(true)
    expect(v2Update?.blockedReason).toBe("New required scopes need consent: customers:read")
    // the active release is never offered as an update
    expect(detail.availableUpdates.some((u) => u.release.id === releaseV1.id)).toBe(false)
  })

  it("returns 404 for an unknown installation", async () => {
    const response = await app.request("/installations/app_installations_missing")
    expect(response.status).toBe(404)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe("App installation not found")
  })

  it("exposes the installation audit trail newest-first", async () => {
    const { appId, releaseV1 } = await seedAppWithReleases()
    const installation = await installV1(appId, releaseV1.id)

    const response = await app.request(`/installations/${installation.id}/audit?limit=5`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Array<{ createdAt: string }> }
    expect(body.data.length).toBeGreaterThan(0)
    const timestamps = body.data.map((row) => row.createdAt)
    const sorted = [...timestamps].sort((a, b) => (a < b ? 1 : -1))
    expect(timestamps).toEqual(sorted)
  })

  it("lists all releases for an app newest-first", async () => {
    const { appId, releaseV2 } = await seedAppWithReleases()

    const response = await app.request(`/${appId}/releases`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Array<{ id: string; releaseVersion: string }> }
    expect(body.data).toHaveLength(2)
    expect(body.data[0]?.id).toBe(releaseV2.id)
  })

  it("drives pause -> resume -> uninstall then purge-preview", async () => {
    const { appId, releaseV1 } = await seedAppWithReleases()
    const installation = await installV1(appId, releaseV1.id)

    const paused = await app.request(
      `/installations/${installation.id}/pause`,
      json({ actorId: "actor_1" }),
    )
    expect(paused.status).toBe(200)
    expect((await paused.json()).data.installation.status).toBe("paused")

    const resumed = await app.request(
      `/installations/${installation.id}/resume`,
      json({ actorId: "actor_1" }),
    )
    expect(resumed.status).toBe(200)
    expect((await resumed.json()).data.installation.status).toBe("active")

    const uninstalled = await app.request(
      `/installations/${installation.id}/uninstall`,
      json({ actorId: "actor_1" }),
    )
    expect(uninstalled.status).toBe(200)
    expect((await uninstalled.json()).data.installation.status).toBe("uninstalled")

    const purge = await app.request(
      `/installations/${installation.id}/purge-preview`,
      json({ actorId: "actor_1" }),
    )
    expect(purge.status).toBe(200)
    const purgeBody = (await purge.json()) as {
      data: { grants: number; extensions: number; webhooks: number; credentials: number }
    }
    expect(purgeBody.data.grants).toBeGreaterThan(0)
    expect(purgeBody.data.extensions).toBeGreaterThan(0)
    expect(purgeBody.data.webhooks).toBeGreaterThan(0)
  })

  it("does not reactivate a retained webhook key after the subscription became inactive", async () => {
    const { appId, releaseV1 } = await seedAppWithReleases()
    const installation = await installV1(appId, releaseV1.id)
    await db
      .update(appWebhookSubscriptions)
      .set({
        status: "inactive",
        signingKeyId: "key_stale",
        pausedAt: null,
        deactivatedAt: null,
      })
      .where(eq(appWebhookSubscriptions.installationId, installation.id))

    const paused = await app.request(
      `/installations/${installation.id}/pause`,
      json({ actorId: "actor_1" }),
    )
    expect(paused.status).toBe(200)
    const resumed = await app.request(
      `/installations/${installation.id}/resume`,
      json({ actorId: "actor_1" }),
    )
    expect(resumed.status).toBe(200)

    const subscriptions = await db
      .select({ status: appWebhookSubscriptions.status })
      .from(appWebhookSubscriptions)
      .where(eq(appWebhookSubscriptions.installationId, installation.id))
    expect(subscriptions).not.toHaveLength(0)
    expect(subscriptions.every(({ status }) => status === "inactive")).toBe(true)
  })

  it("creates an active installation via /install", async () => {
    const { appId, releaseV1 } = await seedAppWithReleases()
    const response = await app.request(
      "/install",
      json({ appId, releaseId: releaseV1.id, actorId: "actor_1" }),
    )
    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      data: { installation: { status: string }; outcome: string }
    }
    expect(body.data.installation.status).toBe("active")
    expect(body.data.outcome).toBe("created")
  })

  it("preserves a manifest slot entryUrl through install and runtime resolution", async () => {
    const service = createAppsService()
    const registration = await service.createCustomApp(db, {
      ownerId: "owner_1",
      displayName: "Invoice Sync",
      slug: "invoice-sync",
      redirectUris: [],
      createdBy: "user_1",
    })
    const manifest = {
      ...validManifest,
      admin: {
        ...validManifest.admin,
        slotExtensions: [
          {
            key: "invoice-detail",
            titleKey: "invoice.detail.title",
            version: "1.0.0",
            extensionApi: "^1",
            entryUrl: "https://app.example.com/extensions/invoice-detail/",
            slots: ["invoice.details.after-summary"],
          },
        ],
      },
      locales: {
        ...validManifest.locales,
        host: {
          ...validManifest.locales.host,
          "en-US": {
            ...validManifest.locales.host["en-US"],
            extensions: { "invoice-detail": "Invoice accounting" },
          },
        },
      },
    }
    const released = await service.releaseFromUpload(db, registration.id, {
      manifest,
      createdBy: "user_1",
      provenance: { source: "test" },
    })
    await installV1(registration.id, released.release.id)

    const resolved = await resolveInstalledExtensions(db, {
      deploymentId: DEPLOYMENT_ID,
      activeLocale: "en-US",
    })

    expect(resolved.slots).toHaveLength(1)
    expect(resolved.slots[0]?.descriptor.entryUrl).toBe(
      "https://app.example.com/extensions/invoice-detail/",
    )
  })

  it("notifies managed authority after a Marketplace uninstall", async () => {
    const { appId, releaseV1 } = await seedAppWithReleases()
    await db.update(apps).set({ distribution: "marketplace" }).where(eq(apps.id, appId))
    const notifyInstallationLifecycle = vi.fn(async () => undefined)
    const managedApp = new Hono()
    managedApp.onError((err, c) => handleApiError(err, c))
    managedApp.use("*", async (c, next) => {
      c.set("db" as never, db)
      await next()
    })
    managedApp.route(
      "/",
      createAppsAdminRoutes({
        deploymentId: DEPLOYMENT_ID,
        managedMarketplace: {
          resolveAcquisitionIntent: async () => null,
          createSetupHandoff: async () => ({
            redirectUrl: "https://app.example.com/setup?code=opaque",
          }),
          notifyInstallationLifecycle,
        },
      }),
    )
    const installed = await managedApp.request(
      "/install",
      json({ appId, releaseId: releaseV1.id, actorId: "actor_1" }),
    )
    const installationId = ((await installed.json()) as { data: { installation: { id: string } } })
      .data.installation.id

    const response = await managedApp.request(
      `/installations/${installationId}/uninstall`,
      json({ actorId: "actor_1" }),
    )

    expect(response.status).toBe(200)
    expect(notifyInstallationLifecycle).toHaveBeenCalledWith({
      event: "uninstalled",
      installationId,
      appId,
      releaseId: releaseV1.id,
    })
  })
})
