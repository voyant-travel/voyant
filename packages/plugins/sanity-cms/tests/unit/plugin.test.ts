import { createEventBus, registerPlugins } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"

import { sanityCmsPlugin } from "../../src/plugin.js"
import type { SanityFetch } from "../../src/types.js"

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
  projectId: "abc123",
  dataset: "production",
  token: "test-token",
  documentType: "product",
}

describe("sanityCmsPlugin", () => {
  it("exposes a stable identity", () => {
    const plugin = sanityCmsPlugin({ ...baseOptions })
    expect(plugin.name).toBe("sanity-cms")
    expect(plugin.version).toBeDefined()
    expect(plugin.subscribers).toHaveLength(3)
  })

  it("subscribes to default product.* events", () => {
    const plugin = sanityCmsPlugin({ ...baseOptions })
    const names = plugin.subscribers?.map((s) => s.event)
    expect(names).toEqual(["product.created", "product.updated", "product.deleted"])
  })

  it("honors custom event names", () => {
    const plugin = sanityCmsPlugin({
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
      sanityCmsPlugin({
        ...baseOptions,
        token: "",
      }),
    ).toThrowError(/Invalid Sanity CMS plugin options/)
  })

  it("pushes product.created to Sanity as a create mutation", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: null }))
      .mockResolvedValueOnce(jsonResponse(200, { results: [{ id: "sn_1", operation: "create" }] }))
    const bus = createEventBus()
    const plugin = sanityCmsPlugin({ ...baseOptions, fetch: fetchMock })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.created", { id: "prod_1", name: "Tour A" })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, createInit] = fetchMock.mock.calls[1]!
    expect(createInit.method).toBe("POST")
    const body = JSON.parse(createInit.body ?? "{}")
    expect(body).toEqual({
      mutations: [{ create: { _type: "product", name: "Tour A", voyantId: "prod_1" } }],
    })
  })

  it("pushes product.updated to Sanity as a patch mutation", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: { _id: "sn_99" } }))
      .mockResolvedValueOnce(jsonResponse(200, { results: [{ id: "sn_99", operation: "update" }] }))
    const bus = createEventBus()
    const plugin = sanityCmsPlugin({ ...baseOptions, fetch: fetchMock })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.updated", { id: "prod_1", name: "Tour B" })

    const [, init] = fetchMock.mock.calls[1]!
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body ?? "{}")
    expect(body).toEqual({
      mutations: [{ patch: { id: "sn_99", set: { name: "Tour B", voyantId: "prod_1" } } }],
    })
  })

  it("deletes from Sanity on product.deleted", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: { _id: "sn_50" } }))
      .mockResolvedValueOnce(jsonResponse(200, { results: [{ id: "sn_50", operation: "delete" }] }))
    const bus = createEventBus()
    const plugin = sanityCmsPlugin({ ...baseOptions, fetch: fetchMock })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.deleted", { id: "prod_1" })

    const [, init] = fetchMock.mock.calls[1]!
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body ?? "{}")
    expect(body).toEqual({ mutations: [{ delete: { id: "sn_50" } }] })
  })

  it("applies a custom mapEvent function", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: null }))
      .mockResolvedValueOnce(jsonResponse(200, { results: [{ id: "sn_1", operation: "create" }] }))
    const bus = createEventBus()
    const plugin = sanityCmsPlugin({
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
      mutations: [
        {
          create: {
            _type: "product",
            title: "Cool Tour",
            _syncedAt: "2024-01-01",
            voyantId: "prod_x",
          },
        },
      ],
    })
  })

  it("ignores events with no string id", async () => {
    const fetchMock = vi.fn<SanityFetch>()
    const bus = createEventBus()
    const plugin = sanityCmsPlugin({ ...baseOptions, fetch: fetchMock })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.created", { name: "no id here" })
    await bus.emit("product.created", null)
    await bus.emit("product.created", { id: 42 })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("logs and swallows Sanity errors (fire-and-forget)", async () => {
    const fetchMock = vi.fn<SanityFetch>().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "server down",
    })
    const errorFn = vi.fn()
    const bus = createEventBus()
    const plugin = sanityCmsPlugin({
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
    expect(msg).toContain('[sanity-cms] upsert on "product.created" failed for prod_1')
  })

  it("uses a custom documentType for the Sanity document", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: null }))
      .mockResolvedValueOnce(jsonResponse(200, { results: [{ id: "sn_1", operation: "create" }] }))
    const bus = createEventBus()
    const plugin = sanityCmsPlugin({
      ...baseOptions,
      documentType: "tour",
      fetch: fetchMock,
    })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.created", { id: "prod_1", name: "X" })

    // find query uses $type=tour
    const [findUrl] = fetchMock.mock.calls[0]!
    expect(findUrl).toContain("$type=%22tour%22")
    // create payload uses _type: "tour"
    const [, createInit] = fetchMock.mock.calls[1]!
    const body = JSON.parse(createInit.body ?? "{}")
    expect(body.mutations[0].create._type).toBe("tour")
  })

  it("does not mutate if the doc is missing on product.deleted", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: null }))
    const bus = createEventBus()
    const plugin = sanityCmsPlugin({ ...baseOptions, fetch: fetchMock })
    registerPlugins([plugin], { eventBus: bus })

    await bus.emit("product.deleted", { id: "prod_missing" })

    // Only the find call should have been made.
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
