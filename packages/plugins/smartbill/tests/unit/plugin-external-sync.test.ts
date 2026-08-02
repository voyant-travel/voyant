import "./plugin-test-setup.js"
import { describe, expect, it, vi } from "vitest"
import { smartbillPlugin } from "../../src/plugin.js"
import {
  baseOptions,
  eventEnvelope,
  jsonResponse,
  makeLogger,
  okEnvelope,
  type SmartbillFetch,
  subscriberFor,
  textResponse,
} from "./plugin-test-helpers.js"

describe("smartbillPlugin — invoice.external.sync.requested subscriber", () => {
  it("calls getPaymentStatus and logs result", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, {
        ...okEnvelope,
        paid: true,
        invoiceTotalAmount: 100,
        paidAmount: 100,
        unpaidAmount: 0,
      }),
    )
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
    const handler = subscriberFor(plugin, "invoice.external.sync.requested").handler

    await handler(eventEnvelope({ id: "inv_sync", externalNumber: "55" }))

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain("/invoice/paymentstatus")
    expect(logger.info).toHaveBeenCalledOnce()
    expect(logger.info.mock.calls[0]![0]).toContain("paid")
  })

  it("logs error when no number is available", async () => {
    const fetchMock = vi.fn<SmartbillFetch>()
    const logger = makeLogger()
    const plugin = smartbillPlugin({ ...baseOptions, fetch: fetchMock, logger })
    const handler = subscriberFor(plugin, "invoice.external.sync.requested").handler

    await handler(eventEnvelope({ id: "inv_no_num" }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledOnce()
    expect(logger.error.mock.calls[0]![0]).toContain("missing external number")
  })

  it("logs error on failure (fire-and-forget)", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () => textResponse(500, "timeout"))
    const logger = makeLogger()
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger,
      // Keep the retried status 500s fast in tests.
      resilience: { retry: { baseDelayMs: 0, maxDelayMs: 1 } },
    })
    const handler = subscriberFor(plugin, "invoice.external.sync.requested").handler

    await handler(eventEnvelope({ id: "inv_err", externalNumber: "1" }))

    expect(logger.error).toHaveBeenCalledOnce()
    expect(logger.error.mock.calls[0]![0]).toContain("getPaymentStatus")
  })
})
