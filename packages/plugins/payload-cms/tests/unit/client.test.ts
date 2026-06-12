import { CircuitOpenError, createCircuitBreaker } from "@voyantjs/utils/resilience"
import { describe, expect, it, vi } from "vitest"

import { createPayloadClient } from "../../src/client.js"
import type { PayloadFetch } from "../../src/types.js"

/** Keeps retrying tests fast and deterministic (no real backoff sleeps). */
const fastRetry = { retry: { baseDelayMs: 0, maxDelayMs: 1 } }

function jsonResponse(status: number, body: unknown) {
  const text = JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  }
}

function textResponse(status: number, text: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error("not json")
    },
    text: async () => text,
  }
}

const baseOptions = {
  apiUrl: "https://cms.example.com/api",
  apiKey: "test-key",
}

describe("createPayloadClient.findByVoyantId", () => {
  it("returns the first matching doc", async () => {
    const fetchMock = vi.fn<PayloadFetch>(async () =>
      jsonResponse(200, { docs: [{ id: "pl_1", name: "a" }], totalDocs: 1 }),
    )
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.findByVoyantId("products", "prod_xyz")
    expect(result).toEqual({ id: "pl_1" })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain("https://cms.example.com/api/products?")
    expect(url).toContain("where[voyantId][equals]=prod_xyz")
    expect(url).toContain("limit=1")
    expect(init.method).toBe("GET")
    expect(init.headers.Authorization).toBe("users API-Key test-key")
  })

  it("returns null when no docs match", async () => {
    const fetchMock = vi.fn<PayloadFetch>(async () => jsonResponse(200, { docs: [], totalDocs: 0 }))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock })
    expect(await client.findByVoyantId("products", "missing")).toBeNull()
  })

  it("respects a custom voyantIdField", async () => {
    const fetchMock = vi.fn<PayloadFetch>(async () => jsonResponse(200, { docs: [] }))
    const client = createPayloadClient({
      ...baseOptions,
      voyantIdField: "externalId",
      fetch: fetchMock,
    })
    await client.findByVoyantId("products", "prod_1")
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain("where[externalId][equals]=prod_1")
  })

  it("respects a custom apiKeyAuthScheme", async () => {
    const fetchMock = vi.fn<PayloadFetch>(async () => jsonResponse(200, { docs: [] }))
    const client = createPayloadClient({
      ...baseOptions,
      apiKeyAuthScheme: "admins API-Key",
      fetch: fetchMock,
    })
    await client.findByVoyantId("products", "prod_1")
    const [, init] = fetchMock.mock.calls[0]!
    expect(init.headers.Authorization).toBe("admins API-Key test-key")
  })

  it("strips trailing slash from apiUrl", async () => {
    const fetchMock = vi.fn<PayloadFetch>(async () => jsonResponse(200, { docs: [] }))
    const client = createPayloadClient({
      ...baseOptions,
      apiUrl: "https://cms.example.com/api/",
      fetch: fetchMock,
    })
    await client.findByVoyantId("products", "x")
    const [url] = fetchMock.mock.calls[0]!
    expect(url.startsWith("https://cms.example.com/api/products?")).toBe(true)
  })

  it("throws on non-2xx response (after exhausting retries)", async () => {
    const fetchMock = vi.fn<PayloadFetch>(async () => textResponse(500, "boom"))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock, resilience: fastRetry })
    await expect(client.findByVoyantId("products", "x")).rejects.toThrow(
      /Payload findByVoyantId\(products\) failed \(500\)/,
    )
    // 5xx is retried; the final failing response is surfaced to error mapping.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe("createPayloadClient.upsertByVoyantId", () => {
  it("creates a new doc when none exists", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [] }))
      .mockResolvedValueOnce(jsonResponse(201, { doc: { id: "pl_new", name: "X" } }))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.upsertByVoyantId("products", "prod_1", { name: "X" })
    expect(result).toEqual({ id: "pl_new", created: true })
    const createCall = fetchMock.mock.calls[1]!
    expect(createCall[0]).toBe("https://cms.example.com/api/products")
    expect(createCall[1].method).toBe("POST")
    const body = JSON.parse(createCall[1].body ?? "{}")
    expect(body).toEqual({ name: "X", voyantId: "prod_1" })
  })

  it("updates an existing doc when found", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [{ id: "pl_existing" }] }))
      .mockResolvedValueOnce(jsonResponse(200, { doc: { id: "pl_existing", name: "Y" } }))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.upsertByVoyantId("products", "prod_1", { name: "Y" })
    expect(result).toEqual({ id: "pl_existing", created: false })
    const patchCall = fetchMock.mock.calls[1]!
    expect(patchCall[0]).toBe("https://cms.example.com/api/products/pl_existing")
    expect(patchCall[1].method).toBe("PATCH")
  })

  it("accepts a top-level id in create response", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [] }))
      .mockResolvedValueOnce(jsonResponse(201, { id: "pl_top" }))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.upsertByVoyantId("products", "prod_1", {})
    expect(result.id).toBe("pl_top")
  })

  it("throws if create response has no id", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [] }))
      .mockResolvedValueOnce(jsonResponse(201, {}))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock })
    await expect(client.upsertByVoyantId("products", "p", {})).rejects.toThrow(
      /response missing id/,
    )
  })

  it("throws on create error", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [] }))
      .mockResolvedValueOnce(textResponse(400, "bad request"))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock })
    await expect(client.upsertByVoyantId("products", "p", {})).rejects.toThrow(
      /Payload create\(products\) failed \(400\)/,
    )
  })

  it("throws on update error", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [{ id: "pl_1" }] }))
      .mockResolvedValueOnce(textResponse(409, "conflict"))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock })
    await expect(client.upsertByVoyantId("products", "p", {})).rejects.toThrow(
      /Payload update\(products\/pl_1\) failed \(409\)/,
    )
  })
})

describe("createPayloadClient.deleteByVoyantId", () => {
  it("deletes when doc exists", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [{ id: "pl_1" }] }))
      .mockResolvedValueOnce(jsonResponse(200, {}))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock })
    expect(await client.deleteByVoyantId("products", "p")).toBe(true)
    const deleteCall = fetchMock.mock.calls[1]!
    expect(deleteCall[0]).toBe("https://cms.example.com/api/products/pl_1")
    expect(deleteCall[1].method).toBe("DELETE")
  })

  it("returns false when doc does not exist", async () => {
    const fetchMock = vi.fn<PayloadFetch>().mockResolvedValueOnce(jsonResponse(200, { docs: [] }))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock })
    expect(await client.deleteByVoyantId("products", "p")).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("treats 404 on delete as success", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [{ id: "pl_1" }] }))
      .mockResolvedValueOnce(textResponse(404, "gone"))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock })
    expect(await client.deleteByVoyantId("products", "p")).toBe(true)
  })

  it("throws on non-2xx, non-404 delete response", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [{ id: "pl_1" }] }))
      .mockResolvedValue(textResponse(500, "boom"))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock, resilience: fastRetry })
    await expect(client.deleteByVoyantId("products", "p")).rejects.toThrow(
      /Payload delete\(products\/pl_1\) failed \(500\)/,
    )
  })
})

describe("createPayloadClient — resilience", () => {
  it("retries a 503 GET and succeeds on a later attempt", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(textResponse(503, "unavailable"))
      .mockResolvedValueOnce(jsonResponse(200, { docs: [{ id: "pl_1" }] }))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock, resilience: fastRetry })
    expect(await client.findByVoyantId("products", "p")).toEqual({ id: "pl_1" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("retries the create POST (idempotent by construction via voyantId)", async () => {
    const fetchMock = vi
      .fn<PayloadFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { docs: [] }))
      .mockResolvedValueOnce(textResponse(503, "unavailable"))
      .mockResolvedValueOnce(jsonResponse(201, { doc: { id: "pl_new" } }))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock, resilience: fastRetry })
    expect(await client.upsertByVoyantId("products", "prod_1", { name: "X" })).toEqual({
      id: "pl_new",
      created: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("does not retry 4xx responses", async () => {
    const fetchMock = vi.fn<PayloadFetch>(async () => textResponse(400, "bad request"))
    const client = createPayloadClient({ ...baseOptions, fetch: fetchMock, resilience: fastRetry })
    await expect(client.findByVoyantId("products", "p")).rejects.toThrow(/failed \(400\)/)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("fails fast with CircuitOpenError once the breaker trips", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1, openMs: 60_000 })
    const fetchMock = vi.fn<PayloadFetch>(async () => textResponse(500, "down"))
    const client = createPayloadClient({
      ...baseOptions,
      fetch: fetchMock,
      resilience: { breaker, retry: false },
    })

    await expect(client.findByVoyantId("products", "p")).rejects.toThrow(/failed \(500\)/)
    expect(fetchMock).toHaveBeenCalledOnce()

    // Breaker is open now: no network call, fail fast.
    await expect(client.findByVoyantId("products", "p")).rejects.toBeInstanceOf(CircuitOpenError)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe("createPayloadClient — fetch handling", () => {
  it("throws when no fetch implementation is available", async () => {
    const originalFetch = globalThis.fetch
    // biome-ignore lint/suspicious/noExplicitAny: stubbing global fetch -- owner: plugins; existing suppression is intentional pending typed cleanup.
    ;(globalThis as any).fetch = undefined
    try {
      // biome-ignore lint/suspicious/noExplicitAny: simulating missing fetch -- owner: plugins; existing suppression is intentional pending typed cleanup.
      const client = createPayloadClient({ ...baseOptions, fetch: undefined as any })
      await expect(client.findByVoyantId("products", "x")).rejects.toThrow(
        /requires a fetch implementation/,
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
