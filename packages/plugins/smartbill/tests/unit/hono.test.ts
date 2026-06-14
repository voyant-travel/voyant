import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createSmartbillAdminRoutes } from "../../src/hono.js"

const financeRuntimeKey = vi.hoisted(() => "providers.finance.runtime")
const syncSmartbillInvoiceMock = vi.hoisted(() => vi.fn())

vi.mock("@voyant-travel/finance", () => ({
  FINANCE_ROUTE_RUNTIME_CONTAINER_KEY: financeRuntimeKey,
}))

vi.mock("../../src/sync.js", () => ({
  syncSmartbillInvoice: syncSmartbillInvoiceMock,
}))

const pluginOptions = {
  username: "user@test.com",
  apiToken: "tok",
  companyVatCode: "RO12345678",
  seriesName: "A",
}

function buildApp(runtime?: unknown) {
  const db = { name: "db" }
  const container = runtime
    ? {
        resolve: vi.fn((key: string) => {
          if (key === financeRuntimeKey) return runtime
          throw new Error(`Unknown container key ${key}`)
        }),
      }
    : undefined
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db", db)
    if (container) c.set("container", container)
    await next()
  })
  app.route("/v1/admin/smartbill", createSmartbillAdminRoutes({ pluginOptions }))
  return { app, db, container }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createSmartbillAdminRoutes", () => {
  it("syncs an invoice through the shared SmartBill service", async () => {
    const resolveInvoiceExchangeRate = vi.fn()
    const onInvoiceFxResolutionError = vi.fn()
    const financeRuntime = {
      eventBus: {},
      invoiceSettlementPollers: {},
      invoiceFxSettings: { baseCurrency: "RON", fxCommissionBps: 200 },
      resolveInvoiceExchangeRate,
      onInvoiceFxResolutionError,
    }
    syncSmartbillInvoiceMock.mockResolvedValueOnce({
      status: "created",
      invoiceId: "inv_123",
      documentType: "invoice",
      result: { number: "42", series: "A" },
      artifact: null,
    })
    const { app, db } = buildApp(financeRuntime)

    const response = await app.request("/v1/admin/smartbill/invoices/inv_123/sync", {
      method: "POST",
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      data: {
        status: "created",
        invoiceId: "inv_123",
        documentType: "invoice",
        result: { number: "42", series: "A" },
        artifact: null,
      },
    })
    expect(syncSmartbillInvoiceMock).toHaveBeenCalledWith({
      db,
      invoiceId: "inv_123",
      pluginOptions,
      issueRuntime: {
        invoiceFxSettings: { baseCurrency: "RON", fxCommissionBps: 200 },
        resolveInvoiceExchangeRate,
        resolveInvoiceExchangeRateResolver: undefined,
        resolveInvoiceFxSettings: undefined,
        updateInvoiceFxSettings: undefined,
        onInvoiceFxResolutionError,
      },
    })
  })

  it("returns not found for missing invoices", async () => {
    syncSmartbillInvoiceMock.mockResolvedValueOnce({
      status: "not_found",
      invoiceId: "missing",
    })
    const { app } = buildApp()

    const response = await app.request("/v1/admin/smartbill/invoices/missing/sync", {
      method: "POST",
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Invoice not found" })
  })

  it("returns bad gateway when SmartBill sync fails", async () => {
    syncSmartbillInvoiceMock.mockRejectedValueOnce(new Error("SmartBill unavailable"))
    const { app } = buildApp()

    const response = await app.request("/v1/admin/smartbill/invoices/inv_123/sync", {
      method: "POST",
    })

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: "SmartBill unavailable" })
  })
})
