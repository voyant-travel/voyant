import type { VoyantAppContextConstraint } from "@voyant-travel/core"
import { handleApiError } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"
import type { AppApiFinanceIssuanceDocument } from "./app-api-contracts.js"
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
    appContextConstraint?: VoyantAppContextConstraint
    scopes: string[]
  }
}

function accessDb(scopes: readonly string[] = ["finance-documents:read"]): PostgresJsDatabase {
  const db = Object.create(null) as PostgresJsDatabase
  Object.assign(db, {
    transaction: (callback: (tx: PostgresJsDatabase) => unknown) => callback(db),
    insert: () => ({ values: async () => undefined }),
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

function issuanceDocument(id: string): AppApiFinanceIssuanceDocument {
  return {
    id,
    documentType: "invoice",
    number: "INV-1",
    status: "issued",
    booking: { id: "booking_1", number: "B-1" },
    billing: {
      name: "Example Customer",
      email: null,
      phone: null,
      address: null,
      city: null,
      region: null,
      country: null,
      vatCode: null,
      registrationNumber: null,
    },
    currency: { document: "EUR", base: null },
    fx: null,
    totals: { subtotalCents: 1000, taxCents: 0, totalCents: 1000 },
    dates: { issuedOn: "2026-07-18", dueOn: null },
    language: "en",
    taxRegime: null,
    series: null,
    allocation: { required: false, pending: false, placeholderNumber: null },
    lines: [],
  }
}

describe("finance App API routes", () => {
  it("hydrates a finance issuance document by stable id", async () => {
    const getIssuanceDocument = vi.fn().mockResolvedValue(issuanceDocument("inv_1"))
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
    await expect(response.json()).resolves.toEqual({ data: issuanceDocument("inv_1") })
  })

  it("fails closed when an online extension token targets another finance document", async () => {
    const getIssuanceDocument = vi.fn(async (_db: unknown, documentId: string) =>
      issuanceDocument(documentId),
    )
    const app = new Hono<TestEnv>()
    app.onError((error, c) => handleApiError(error, c))
    app.use("*", async (c, next) => {
      c.set("db", accessDb())
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "online")
      c.set("appContextConstraint", {
        entity: { type: "invoice", id: "inv_1" },
        slot: "invoice.details.after-summary",
      })
      c.set("scopes", ["finance-documents:read"])
      await next()
    })
    app.route("/", createAppsAppApiRoutes({ finance: { getIssuanceDocument } }))

    const allowed = await app.request("/v1/app/finance/documents/inv_1")
    expect(allowed.status).toBe(200)
    expect(getIssuanceDocument).toHaveBeenCalledWith(expect.anything(), "inv_1")
    getIssuanceDocument.mockClear()

    const response = await app.request("/v1/app/finance/documents/inv_other")

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      code: "app_api_entity_context_mismatch",
    })
    expect(getIssuanceDocument).not.toHaveBeenCalled()
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

  it("attaches a bounded PDF and returns an app-safe rendition URL", async () => {
    const scopes = ["finance-document-artifacts:write"]
    const attachPdfArtifact = vi.fn().mockResolvedValue({
      status: "ok",
      outcome: "created",
      artifact: {
        id: "rend_1",
        documentId: "inv_1",
        provider: "app_1",
        fileName: "invoice.pdf",
        byteSize: 9,
        checksum: "checksum",
        storageKey: "must-not-cross-app-api-boundary",
        createdAt: "2026-07-18T09:00:00.000Z",
      },
    })
    const app = new Hono<TestEnv>()
    app.use("*", async (c, next) => {
      c.set("db", accessDb(scopes))
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", scopes)
      await next()
    })
    app.route("/", createAppsAppApiRoutes({ finance: { attachPdfArtifact } }))

    const response = await app.request(
      "https://operator.example/v1/app/finance/documents/inv_1/artifacts/provider-pdf",
      {
        method: "PUT",
        headers: {
          "content-type": "application/pdf",
          "idempotency-key": "pdf:operation-1",
          "x-voyant-artifact-name": "invoice.pdf",
        },
        body: "%PDF-test",
      },
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toEqual({
      data: {
        outcome: "created",
        artifact: expect.objectContaining({
          id: "rend_1",
          documentUrl:
            "https://operator.example/v1/admin/finance/invoice-renditions/rend_1/download",
        }),
      },
    })
    expect(JSON.stringify(payload)).not.toContain("storageKey")
    expect(attachPdfArtifact).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      "inv_1",
      "app_1",
      expect.objectContaining({ idempotencyKey: "pdf:operation-1" }),
    )
  })

  it("rejects unsupported artifact content before invoking Finance", async () => {
    const attachPdfArtifact = vi.fn()
    const app = new Hono<TestEnv>()
    app.onError((error, c) => handleApiError(error, c))
    app.use("*", async (c, next) => {
      c.set("db", accessDb(["finance-document-artifacts:write"]))
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", ["finance-document-artifacts:write"])
      await next()
    })
    app.route("/", createAppsAppApiRoutes({ finance: { attachPdfArtifact } }))

    const response = await app.request("/v1/app/finance/documents/inv_1/artifacts/provider-pdf", {
      method: "PUT",
      headers: {
        "content-type": "text/plain",
        "idempotency-key": "pdf:operation-1",
        "x-voyant-artifact-name": "invoice.pdf",
      },
      body: "not a pdf",
    })

    expect(response.status).toBe(415)
    expect(attachPdfArtifact).not.toHaveBeenCalled()
  })

  it("stops reading an artifact stream when its actual bytes exceed the limit", async () => {
    const attachPdfArtifact = vi.fn()
    const app = new Hono<TestEnv>()
    app.onError((error, c) => handleApiError(error, c))
    app.use("*", async (c, next) => {
      c.set("db", accessDb(["finance-document-artifacts:write"]))
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", ["finance-document-artifacts:write"])
      await next()
    })
    app.route(
      "/",
      createAppsAppApiRoutes({ finance: { attachPdfArtifact }, maxFinanceArtifactBytes: 8 }),
    )

    const response = await app.request("/v1/app/finance/documents/inv_1/artifacts/provider-pdf", {
      method: "PUT",
      headers: {
        "content-type": "application/pdf",
        "idempotency-key": "pdf:operation-1",
        "x-voyant-artifact-name": "invoice.pdf",
      },
      body: "%PDF-test",
    })

    expect(response.status).toBe(413)
    expect(attachPdfArtifact).not.toHaveBeenCalled()
  })

  it("rejects artifact writes whose token does not match the deployment installation", async () => {
    const scopes = ["finance-document-artifacts:write"]
    const attachPdfArtifact = vi.fn()
    const app = new Hono<TestEnv>()
    app.onError((error, c) => handleApiError(error, c))
    app.use("*", async (c, next) => {
      c.set("db", accessDb(scopes))
      c.set("callerType", "app")
      c.set("appId", "app_from_another_deployment")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", scopes)
      await next()
    })
    app.route("/", createAppsAppApiRoutes({ finance: { attachPdfArtifact } }))

    const response = await app.request("/v1/app/finance/documents/inv_1/artifacts/provider-pdf", {
      method: "PUT",
      headers: {
        "content-type": "application/pdf",
        "idempotency-key": "pdf:operation-1",
        "x-voyant-artifact-name": "invoice.pdf",
      },
      body: "%PDF-test",
    })

    expect(response.status).toBe(403)
    expect(attachPdfArtifact).not.toHaveBeenCalled()
  })

  it("reports ordered provider-neutral external sync state", async () => {
    const scopes = ["finance-external-sync:write"]
    const updateExternalSyncState = vi.fn().mockResolvedValue({
      status: "ok",
      outcome: "updated",
      sync: {
        provider: "app_1",
        documentId: "inv_1",
        operationId: "operation-1",
        status: "retryable_failure",
        occurredAt: "2026-07-18T09:00:00.000Z",
        error: { code: "provider_timeout", message: "Provider timed out." },
        metadata: null,
      },
    })
    const app = new Hono<TestEnv>()
    app.use("*", async (c, next) => {
      c.set("db", accessDb(scopes))
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", scopes)
      await next()
    })
    app.route("/", createAppsAppApiRoutes({ finance: { updateExternalSyncState } }))

    const response = await app.request("/v1/app/finance/documents/inv_1/external-sync-state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operationId: "operation-1",
        status: "retryable_failure",
        occurredAt: "2026-07-18T09:00:00.000Z",
        error: { code: "provider_timeout", message: "Provider timed out." },
        metadata: null,
      }),
    })

    expect(response.status).toBe(200)
    expect(updateExternalSyncState).toHaveBeenCalledWith(
      expect.anything(),
      "inv_1",
      "app_1",
      expect.objectContaining({ operationId: "operation-1" }),
    )
  })

  it("records a converted document lifecycle observation with explicit lineage", async () => {
    const scopes = ["finance-external-lifecycle:write"]
    const updateExternalLifecycleState = vi.fn().mockResolvedValue({
      status: "ok",
      outcome: "created",
      lifecycle: {
        provider: "app_1",
        documentId: "proforma_1",
        operationId: "conversion-1",
        state: "converted",
        occurredAt: "2026-07-18T10:00:00.000Z",
        lineage: {
          sourceDocumentId: "proforma_1",
          successorDocumentId: "invoice_1",
        },
      },
    })
    const app = new Hono<TestEnv>()
    app.use("*", async (c, next) => {
      c.set("db", accessDb(scopes))
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", scopes)
      await next()
    })
    app.route("/", createAppsAppApiRoutes({ finance: { updateExternalLifecycleState } }))

    const response = await app.request(
      "/v1/app/finance/documents/proforma_1/external-lifecycle-state",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "conversion-1",
          state: "converted",
          occurredAt: "2026-07-18T10:00:00.000Z",
          lineage: {
            sourceDocumentId: "proforma_1",
            successorDocumentId: "invoice_1",
          },
        }),
      },
    )

    expect(response.status).toBe(200)
    expect(updateExternalLifecycleState).toHaveBeenCalledWith(
      expect.anything(),
      "proforma_1",
      "app_1",
      expect.objectContaining({ state: "converted" }),
    )
  })

  it("records a provider-neutral settlement observation without a payment mutation", async () => {
    const scopes = ["finance-settlement-observations:write"]
    const recordSettlementObservation = vi.fn().mockResolvedValue({
      status: "ok",
      outcome: "created",
      observation: {
        provider: "app_1",
        documentId: "invoice_1",
        operationId: "settlement-1",
        occurredAt: "2026-07-18T11:00:00.000Z",
        status: "paid",
        currency: "EUR",
        totals: { totalCents: 1000, paidCents: 1000, balanceDueCents: 0 },
        paymentIdentifiers: ["payment-1"],
      },
    })
    const app = new Hono<TestEnv>()
    app.use("*", async (c, next) => {
      c.set("db", accessDb(scopes))
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", scopes)
      await next()
    })
    app.route("/", createAppsAppApiRoutes({ finance: { recordSettlementObservation } }))

    const response = await app.request(
      "/v1/app/finance/documents/invoice_1/settlement-observations",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "settlement-1",
          occurredAt: "2026-07-18T11:00:00.000Z",
          status: "paid",
          currency: "EUR",
          totals: { totalCents: 1000, paidCents: 1000, balanceDueCents: 0 },
          paymentIdentifiers: ["payment-1"],
        }),
      },
    )

    expect(response.status).toBe(201)
    expect(recordSettlementObservation).toHaveBeenCalledWith(
      expect.anything(),
      "invoice_1",
      "app_1",
      expect.objectContaining({ paymentIdentifiers: ["payment-1"] }),
    )
  })

  it("enforces the signed entity constraint on lifecycle and settlement writes", async () => {
    const scopes = ["finance-external-lifecycle:write", "finance-settlement-observations:write"]
    const updateExternalLifecycleState = vi.fn()
    const recordSettlementObservation = vi.fn()
    const app = new Hono<TestEnv>()
    app.onError((error, c) => handleApiError(error, c))
    app.use("*", async (c, next) => {
      c.set("db", accessDb(scopes))
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "online")
      c.set("appContextConstraint", {
        entity: { type: "invoice", id: "invoice_1" },
        slot: "invoice.details.after-summary",
      })
      c.set("scopes", scopes)
      await next()
    })
    app.route(
      "/",
      createAppsAppApiRoutes({
        finance: { updateExternalLifecycleState, recordSettlementObservation },
      }),
    )

    const lifecycle = await app.request(
      "/v1/app/finance/documents/invoice_other/external-lifecycle-state",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "void-1",
          state: "voided",
          occurredAt: "2026-07-18T10:00:00.000Z",
          lineage: null,
        }),
      },
    )
    const settlement = await app.request(
      "/v1/app/finance/documents/invoice_other/settlement-observations",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "settlement-1",
          occurredAt: "2026-07-18T11:00:00.000Z",
          status: "paid",
          currency: "EUR",
          totals: { totalCents: 1000, paidCents: 1000, balanceDueCents: 0 },
          paymentIdentifiers: ["payment-1"],
        }),
      },
    )

    expect(lifecycle.status).toBe(403)
    expect(settlement.status).toBe(403)
    expect(updateExternalLifecycleState).not.toHaveBeenCalled()
    expect(recordSettlementObservation).not.toHaveBeenCalled()
  })

  it("returns stable public conflicts for reused lifecycle and settlement operations", async () => {
    const scopes = ["finance-external-lifecycle:write", "finance-settlement-observations:write"]
    const updateExternalLifecycleState = vi.fn().mockResolvedValue({
      status: "conflict",
      reason: "idempotency_key_reused",
      current: null,
    })
    const recordSettlementObservation = vi.fn().mockResolvedValue({
      status: "conflict",
      reason: "settlement_regression",
      current: null,
    })
    const app = new Hono<TestEnv>()
    app.onError((error, c) => handleApiError(error, c))
    app.use("*", async (c, next) => {
      c.set("db", accessDb(scopes))
      c.set("callerType", "app")
      c.set("appId", "app_1")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", scopes)
      await next()
    })
    app.route(
      "/",
      createAppsAppApiRoutes({
        finance: { updateExternalLifecycleState, recordSettlementObservation },
      }),
    )

    const lifecycle = await app.request(
      "/v1/app/finance/documents/invoice_1/external-lifecycle-state",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "void-1",
          state: "voided",
          occurredAt: "2026-07-18T10:00:00.000Z",
          lineage: null,
        }),
      },
    )
    const settlement = await app.request(
      "/v1/app/finance/documents/invoice_1/settlement-observations",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "settlement-2",
          occurredAt: "2026-07-18T12:00:00.000Z",
          status: "partial",
          currency: "EUR",
          totals: { totalCents: 1000, paidCents: 500, balanceDueCents: 500 },
          paymentIdentifiers: ["payment-1"],
        }),
      },
    )

    expect(lifecycle.status).toBe(409)
    await expect(lifecycle.json()).resolves.toMatchObject({
      code: "app_api_finance_external_lifecycle_idempotency_key_reused",
    })
    expect(settlement.status).toBe(409)
    await expect(settlement.json()).resolves.toMatchObject({
      code: "app_api_finance_settlement_observation_settlement_regression",
    })
  })

  it("denies lifecycle and settlement writes across installation boundaries", async () => {
    const scopes = ["finance-external-lifecycle:write", "finance-settlement-observations:write"]
    const updateExternalLifecycleState = vi.fn()
    const recordSettlementObservation = vi.fn()
    const app = new Hono<TestEnv>()
    app.onError((error, c) => handleApiError(error, c))
    app.use("*", async (c, next) => {
      c.set("db", accessDb(scopes))
      c.set("callerType", "app")
      c.set("appId", "app_from_another_deployment")
      c.set("appInstallationId", "inst_1")
      c.set("appReleaseId", "rel_1")
      c.set("appTokenMode", "offline")
      c.set("scopes", scopes)
      await next()
    })
    app.route(
      "/",
      createAppsAppApiRoutes({
        finance: { updateExternalLifecycleState, recordSettlementObservation },
      }),
    )

    const requests = [
      app.request("/v1/app/finance/documents/invoice_1/external-lifecycle-state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "void-1",
          state: "voided",
          occurredAt: "2026-07-18T10:00:00.000Z",
          lineage: null,
        }),
      }),
      app.request("/v1/app/finance/documents/invoice_1/settlement-observations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "settlement-1",
          occurredAt: "2026-07-18T11:00:00.000Z",
          status: "paid",
          currency: "EUR",
          totals: { totalCents: 1000, paidCents: 1000, balanceDueCents: 0 },
          paymentIdentifiers: ["payment-1"],
        }),
      }),
    ]

    for (const response of await Promise.all(requests)) expect(response.status).toBe(403)
    expect(updateExternalLifecycleState).not.toHaveBeenCalled()
    expect(recordSettlementObservation).not.toHaveBeenCalled()
  })
})
