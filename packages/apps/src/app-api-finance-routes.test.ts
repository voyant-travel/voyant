import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"
import { createAppsAppApiRoutes } from "./app-api-routes.js"
import { appGrants, appInstallations, appReleases } from "./schema.js"

type TestEnv = {
  Variables: {
    db: PostgresJsDatabase
    callerType: string
    appId: string
    appInstallationId: string
    appReleaseId: string
    appTokenMode: "offline" | "online"
    scopes: string[]
  }
}

function accessDb(scopes: readonly string[] = ["finance-documents:read"]): PostgresJsDatabase {
  const db = Object.create(null) as PostgresJsDatabase
  Object.assign(db, {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const rows = () => {
            if (table === appInstallations) {
              return [
                {
                  id: "inst_1",
                  appId: "app_1",
                  deploymentId: "dep_1",
                  releaseId: "rel_1",
                  status: "active",
                  namespace: "app--one",
                },
              ]
            }
            if (table === appReleases) {
              return [
                {
                  id: "rel_1",
                  appId: "app_1",
                  releaseVersion: "1.0.0",
                  apiCompatibility: { min: "2026-07-01", max: "2026-12-31" },
                },
              ]
            }
            if (table === appGrants) return scopes.map((scope) => ({ scope }))
            return []
          }
          return {
            // biome-ignore lint/suspicious/noThenProperty: models Drizzle's awaitable query builder.
            then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows()).then(resolve),
            limit: async () => rows(),
          }
        },
      }),
    }),
  })
  return db
}

describe("finance App API routes", () => {
  it("hydrates a finance issuance document by stable id", async () => {
    const getIssuanceDocument = vi.fn().mockResolvedValue({ id: "inv_1" })
    const app = new Hono<TestEnv>()
    app.use("*", async (c, next) => {
      c.set("db", accessDb())
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", ["finance-documents:read"])
      await next()
    })
    app.route("/", createAppsAppApiRoutes({ finance: { getIssuanceDocument } }))

    const response = await app.request("/v1/app/finance/documents/inv_1")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { id: "inv_1" } })
  })

  it("does not expose a caller-selected provider reference route", async () => {
    const getExternalReference = vi.fn().mockResolvedValue({ id: "ref_1" })
    const upsertExternalReference = vi.fn()
    const app = new Hono<TestEnv>()
    app.use("*", async (c, next) => {
      c.set("db", accessDb(["finance-external-references:read"]))
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", ["finance-external-references:read"])
      await next()
    })
    app.route(
      "/",
      createAppsAppApiRoutes({ finance: { getExternalReference, upsertExternalReference } }),
    )

    const ownedResponse = await app.request("/v1/app/finance/documents/inv_1/external-reference")
    expect(ownedResponse.status).toBe(200)
    expect(getExternalReference).toHaveBeenCalledWith(expect.anything(), "inv_1", "app_1")

    const response = await app.request(
      "/v1/app/finance/documents/inv_1/external-references/another-provider",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reference: {
            externalId: null,
            externalNumber: null,
            externalUrl: null,
            status: null,
            metadata: null,
            syncedAt: null,
            syncError: null,
          },
        }),
      },
    )

    expect(response.status).toBe(404)
    expect(upsertExternalReference).not.toHaveBeenCalled()
  })

  it("atomically writes the owned reference, allocation, and audit through HTTP", async () => {
    const scopes = ["finance-external-references:write", "finance-external-allocation:write"]
    const db = accessDb(scopes)
    const auditValues = vi.fn().mockResolvedValue(undefined)
    Object.assign(db, {
      transaction: (callback: (tx: PostgresJsDatabase) => unknown) => callback(db),
      insert: () => ({ values: auditValues }),
    })
    const upsertExternalReference = vi.fn().mockResolvedValue({
      status: "ok",
      reference: { id: "ref_1" },
      referenceOutcome: "created",
      allocationOutcome: "applied",
    })
    const app = new Hono<TestEnv>()
    app.use("*", async (c, next) => {
      c.set("db", db)
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", scopes)
      await next()
    })
    app.route("/", createAppsAppApiRoutes({ finance: { upsertExternalReference } }))

    const response = await app.request("/v1/app/finance/documents/inv_1/external-reference", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reference: {
          externalId: "remote_1",
          externalNumber: "SB-42",
          externalUrl: null,
          status: "issued",
          metadata: null,
          syncedAt: null,
          syncError: null,
        },
        allocation: { invoiceNumber: "SB-42" },
      }),
    })

    expect(response.status).toBe(200)
    expect(upsertExternalReference).toHaveBeenCalledWith(db, "inv_1", "app_1", expect.anything())
    expect(auditValues).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "app_1",
        action: "finance.external-reference.upserted",
      }),
    )
  })
})
