import "./plugin-test-setup.js"
import { describe, expect, it, vi } from "vitest"
import { smartbillPlugin } from "../../src/plugin.js"
import { baseOptions, financeServiceMock, type SmartbillFetch } from "./plugin-test-helpers.js"

describe("smartbillPlugin structure", () => {
  it("returns a Plugin with name and version", () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock })
    expect(plugin.name).toBe("smartbill")
    expect(plugin.version).toBe("0.1.0")
    expect(plugin.subscribers).toHaveLength(5)
  })

  it("subscribes to default event names", () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock })
    const events = plugin.subscribers!.map((s) => s.event)
    expect(events).toEqual([
      "invoice.issued",
      "invoice.proforma.issued",
      "invoice.proforma.converted",
      "invoice.voided",
      "invoice.external.sync.requested",
    ])
  })

  it("subscribes to custom event names", () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      events: {
        issued: "custom.issued",
        proformaConverted: "custom.converted",
        voided: "custom.voided",
        syncRequested: "custom.sync",
      },
    })
    const events = plugin.subscribers!.map((s) => s.event)
    expect(events).toEqual([
      "custom.issued",
      "invoice.proforma.issued",
      "custom.converted",
      "custom.voided",
      "custom.sync",
    ])
  })

  it("bootstraps SmartBill external number series when artifact db is static", async () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const db = {} as never
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      artifacts: { db },
    })

    await plugin.bootstrap?.({ bindings: {}, container: {} as never, eventBus: {} as never })

    expect(financeServiceMock.ensureExternalInvoiceNumberSeries).toHaveBeenCalledWith(db, [
      {
        provider: "smartbill",
        scope: "invoice",
        code: "smartbill-invoice",
        name: "SmartBill invoices",
        externalConfigKey: "A",
        isDefault: true,
      },
      {
        provider: "smartbill",
        scope: "proforma",
        code: "smartbill-proforma",
        name: "SmartBill proformas",
        externalConfigKey: "A",
        isDefault: true,
      },
    ])
  })

  it("skips SmartBill external number series bootstrap for dynamic artifact db", async () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      artifacts: { db: () => null },
    })

    await plugin.bootstrap?.({ bindings: {}, container: {} as never, eventBus: {} as never })

    expect(financeServiceMock.ensureExternalInvoiceNumberSeries).not.toHaveBeenCalled()
  })

  it("fails fast on invalid plugin options", () => {
    expect(() =>
      smartbillPlugin({
        ...baseOptions,
        username: "",
      }),
    ).toThrowError(/Invalid SmartBill plugin options/)
  })
})
