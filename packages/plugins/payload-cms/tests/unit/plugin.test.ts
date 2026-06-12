import { createEventBus, registerPlugins } from "@voyantjs/core"
import { describe, expect, it, vi } from "vitest"

import { payloadCmsPlugin } from "../../src/plugin.js"
import type { PayloadFetch } from "../../src/types.js"

function jsonResponse(status: number, body: unknown) {
  const text = JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  }
}

const baseOptions = {
  apiUrl: "https://cms.example.com/api",
  apiKey: "test-key",
  collection: "products",
}

describe("payloadCmsPlugin", () => {
  it("exposes a stable identity", () => {
    const plugin = payloadCmsPlugin({ ...baseOptions })
    expect(plugin.name).toBe("payload-cms")
    expect(plugin.version).toBeDefined()
    expect(plugin.subscribers).toHaveLength(3)
  })

  it("subscribes to default product.* events", () => {
    const plugin = payloadCmsPlugin({ ...baseOptions })
    const names = plugin.subscribers?.map((s) => s.event)
    expect(names).toEqual(["product.created", "product.updated", "product.deleted"])
  })

  it("honors custom event names", () => {
    const plugin = payloadCmsPlugin({
      ...baseOptions,
      events: {
        created: "departure.created",
        updated: "departure.updated",
        deleted: "departure.deleted",
      },
    })
    const names = plugin.subscribers?.map((s) => s.event)
    expect(names).toEqual(["departure.created", "departure.updated", "departure.deleted"])
  })

  it("fails fast on invalid plugin options", () => {
    expect(() =>
      payloadCmsPlugin({
        ...baseOptions,
        apiUrl: "not-a-url",
      }),
    ).toThrowError(/Invalid Payload CMS plugin options/)
  })

  it("pushes product.created to Payload as an upsert", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [] }))
      .mockResolvedValueOnce(jsonResponse(201, { doc: { id: "pl_1" } }))
    const bus = createEventBus()
    const plugin = payloadCmsPlugin({ ...baseOptions, fetch: fetchMock })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.created", { id: "prod_1", name: "Tour A" })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, createInit] = fetchMock.mock.calls[1]!
    expect(createInit.method).toBe("POST")
    const body = JSON.parse(createInit.body ?? "{}")
    expect(body).toEqual({ name: "Tour A", voyantId: "prod_1" })
  })

  it("pushes product.updated to Payload as an upsert", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [{ id: "pl_99" }] }))
      .mockResolvedValueOnce(jsonResponse(200, { doc: { id: "pl_99" } }))
    const bus = createEventBus()
    const plugin = payloadCmsPlugin({ ...baseOptions, fetch: fetchMock })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.updated", { id: "prod_1", name: "Tour B" })

    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe("https://cms.example.com/api/products/pl_99")
    expect(init.method).toBe("PATCH")
  })

  it("deletes from Payload on product.deleted", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [{ id: "pl_50" }] }))
      .mockResolvedValueOnce(jsonResponse(200, {}))
    const bus = createEventBus()
    const plugin = payloadCmsPlugin({ ...baseOptions, fetch: fetchMock })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.deleted", { id: "prod_1" })

    const [url, init] = fetchMock.mock.calls[1]!
    expect(url).toBe("https://cms.example.com/api/products/pl_50")
    expect(init.method).toBe("DELETE")
  })

  it("applies a custom mapEvent function", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [] }))
      .mockResolvedValueOnce(jsonResponse(201, { doc: { id: "pl_1" } }))
    const bus = createEventBus()
    const plugin = payloadCmsPlugin({
      ...baseOptions,
      fetch: fetchMock,
      mapEvent: (event) => ({
        title: String(event.name ?? ""),
        _syncedAt: "2024-01-01",
      }),
    })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.created", { id: "prod_x", name: "Cool Tour" })

    const [, init] = fetchMock.mock.calls[1]!
    const body = JSON.parse(init.body ?? "{}")
    expect(body).toEqual({
      title: "Cool Tour",
      _syncedAt: "2024-01-01",
      voyantId: "prod_x",
    })
  })

  it("ignores events with no string id", async () => {
    const fetchMock = vi.fn<PayloadFetch>()
    const bus = createEventBus()
    const plugin = payloadCmsPlugin({ ...baseOptions, fetch: fetchMock })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.created", { name: "no id here" })
    await bus.emit("product.created", null)
    await bus.emit("product.created", { id: 42 })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("logs and swallows Payload errors (fire-and-forget)", async () => {
    const fetchMock = vi.fn<PayloadFetch>().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "server down",
    })
    const errorFn = vi.fn()
    const bus = createEventBus()
    const plugin = payloadCmsPlugin({
      ...baseOptions,
      fetch: fetchMock,
      logger: { error: errorFn },
      // Keep the retried 500s fast in tests.
      resilience: { retry: { baseDelayMs: 0, maxDelayMs: 1 } },
    })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.created", { id: "prod_1", name: "X" })

    expect(errorFn).toHaveBeenCalledOnce()
    const [msg] = errorFn.mock.calls[0]!
    expect(msg).toContain('[payload-cms] upsert on "product.created" failed for prod_1')
  })

  it("uses a custom collection name for the Payload path", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [] }))
      .mockResolvedValueOnce(jsonResponse(201, { doc: { id: "pl_1" } }))
    const bus = createEventBus()
    const plugin = payloadCmsPlugin({
      ...baseOptions,
      collection: "tours",
      fetch: fetchMock,
    })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.created", { id: "prod_1", name: "X" })

    const [findUrl] = fetchMock.mock.calls[0]!
    expect(findUrl).toContain("https://cms.example.com/api/tours?")
    const [createUrl] = fetchMock.mock.calls[1]!
    expect(createUrl).toBe("https://cms.example.com/api/tours")
  })

  it("does not delete if the doc is missing on product.deleted", async () => {
    const fetchMock = vi.fn<PayloadFetch>().mockResolvedValueOnce(jsonResponse(200, { docs: [] }))
    const bus = createEventBus()
    const plugin = payloadCmsPlugin({ ...baseOptions, fetch: fetchMock })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.deleted", { id: "prod_missing" })

    // Only the find call should have been made.
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
