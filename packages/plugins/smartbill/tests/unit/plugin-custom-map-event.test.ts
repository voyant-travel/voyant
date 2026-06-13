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
} from "./plugin-test-helpers.js"

describe("smartbillPlugin — custom mapEvent", () => {
  it("uses custom mapper when provided", async () => {
    const fetchMock = vi.fn<SmartbillFetch>(async () =>
      jsonResponse(200, { ...okEnvelope, number: "1", series: "A" }),
    )
    const logger = makeLogger()
    const customMapper = vi.fn().mockReturnValue({
      companyVatCode: "CUSTOM",
      client: { name: "Custom" },
      seriesName: "Z",
      currency: "EUR",
      products: [],
    })
    const plugin = smartbillPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger,
      mapEvent: customMapper,
    })
    const handler = subscriberFor(plugin, "invoice.issued").handler

    await handler(eventEnvelope({ id: "inv_custom" }))

    expect(customMapper).toHaveBeenCalledOnce()
    expect(customMapper.mock.calls[0]![0].id).toBe("inv_custom")
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body ?? "{}")
    expect(body.companyVatCode).toBe("CUSTOM")
  })
})
