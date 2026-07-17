import { ApiHttpError } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"
import {
  type AppApiAccessContext,
  assertAppNamespaceAlias,
  assertCompatibleVersion,
  createAppApiService,
} from "./app-api-service.js"
import { appGrants, appInstallations, appReleases } from "./schema.js"

function postgresStub(implementation: object): PostgresJsDatabase {
  const db = Object.create(null) as PostgresJsDatabase
  Object.assign(db, implementation)
  return db
}

function createAccessDb(options: {
  status?: "active" | "paused"
  scopes?: readonly string[]
  releaseRange?: { min: string; max: string }
}) {
  const installation = {
    id: "inst_1",
    appId: "app_1",
    deploymentId: "dep_1",
    releaseId: "rel_1",
    status: options.status ?? "active",
    namespace: "app--one",
  }
  const release = {
    id: "rel_1",
    appId: "app_1",
    releaseVersion: "1.0.0",
    apiCompatibility: options.releaseRange ?? { min: "2026-07-01", max: "2026-12-31" },
  }
  return postgresStub({
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const rows = () => {
            if (table === appInstallations) return [installation]
            if (table === appReleases) return [release]
            if (table === appGrants) return (options.scopes ?? []).map((scope) => ({ scope }))
            return []
          }
          return {
            // biome-ignore lint/suspicious/noThenProperty: test stub models Drizzle's awaitable query builder -- owner: apps.
            then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows()).then(resolve),
            orderBy: async () => rows(),
            limit: async () => rows(),
          }
        },
      }),
    }),
  })
}

const context: AppApiAccessContext = {
  appId: "app_1",
  installationId: "inst_1",
  releaseId: "rel_1",
  tokenMode: "offline",
  scopes: [],
  apiVersion: "2026-07-01",
}

describe("App API service boundary", () => {
  it("rejects direct service calls when the installation is inactive", async () => {
    const service = createAppApiService()

    await expect(
      service.requireAccess(
        createAccessDb({ status: "paused", scopes: ["app-installation:read"] }),
        context,
        ["app-installation:read"],
      ),
    ).rejects.toMatchObject({ status: 403, code: "app_installation_not_active" })
  })

  it("rejects direct service calls when required scopes are not granted", async () => {
    const service = createAppApiService()

    await expect(
      service.requireAccess(createAccessDb({ scopes: [] }), context, ["app-installation:read"]),
    ).rejects.toMatchObject({ status: 403, code: "app_installation_scope_missing" })
  })

  it("fails closed when the requested API version is outside the installed release range", async () => {
    const service = createAppApiService()

    await expect(
      service.requireAccess(
        createAccessDb({
          scopes: ["app-installation:read"],
          releaseRange: { min: "2026-08-01", max: "2026-12-31" },
        }),
        context,
        ["app-installation:read"],
      ),
    ).rejects.toMatchObject({ status: 426, code: "app_api_version_out_of_range" })
  })

  it("requires action-ledger approval for finance actions even when OAuth scope is granted", async () => {
    const executeAction = vi.fn()
    const service = createAppApiService({
      finance: { listDocuments: vi.fn(), executeAction },
    })

    await expect(
      service.executeFinanceAction(createAccessDb({ scopes: ["finance-actions:issue"] }), context, {
        action: "issue",
        idempotencyKey: "idem_1",
        payload: {},
      }),
    ).rejects.toMatchObject({ status: 403, code: "app_api_finance_approval_required" })
    expect(executeAction).not.toHaveBeenCalled()
  })

  it("isolates rate limits per installation", async () => {
    const service = createAppApiService({
      rateLimit: { installationLimit: 1, appLimit: 10, windowMs: 60_000 },
    })
    const rateContext = { ...context, appId: "rate_app", installationId: "rate_inst_1" }

    service.enforceRateLimit(rateContext)
    expect(() => service.enforceRateLimit(rateContext)).toThrow(ApiHttpError)
    expect(() =>
      service.enforceRateLimit({ ...rateContext, installationId: "rate_inst_2" }),
    ).not.toThrow()
  })

  it("accepts only the $app custom-field namespace alias from request data", () => {
    expect(() => assertAppNamespaceAlias(undefined)).not.toThrow()
    expect(() => assertAppNamespaceAlias("$app")).not.toThrow()
    expect(() => assertAppNamespaceAlias("$app:sync")).not.toThrow()
    expect(() => assertAppNamespaceAlias("app--foreign")).toThrow(ApiHttpError)
    expect(() => assertAppNamespaceAlias("custom")).toThrow(ApiHttpError)
  })

  it("compares App API compatibility ranges inclusively", () => {
    expect(() =>
      assertCompatibleVersion("2026-07-01", { min: "2026-07-01", max: "2026-12-31" }),
    ).not.toThrow()
    expect(() =>
      assertCompatibleVersion("2027-01-01", { min: "2026-07-01", max: "2026-12-31" }),
    ).toThrow(ApiHttpError)
  })
})
