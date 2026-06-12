import { CircuitOpenError, createCircuitBreaker } from "@voyantjs/utils/resilience"
import { describe, expect, it, vi } from "vitest"

import { createSanityClient } from "../../src/client.js"
import type { SanityFetch } from "../../src/types.js"

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
  projectId: "abc123",
  dataset: "production",
  token: "test-token",
}

describe("createSanityClient.findByVoyantId", () => {
  it("returns the first matching doc", async () => {
    const fetchMock = vi.fn<SanityFetch>(async () =>
      jsonResponse(200, { result: { _id: "sn_1", name: "a" } }),
    )
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.findByVoyantId("product", "prod_xyz")
    expect(result).toEqual({ _id: "sn_1" })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain("https://abc123.api.sanity.io/v2024-01-01/data/query/production?")
    // GROQ query with voyantIdField and params
    expect(url).toContain("query=")
    expect(url).toContain("voyantId%20%3D%3D%20%24vid")
    // JSON-encoded param values (`$` is not percent-encoded in param keys)
    expect(url).toContain("$type=%22product%22")
    expect(url).toContain("$vid=%22prod_xyz%22")
    expect(init.method).toBe("GET")
    expect(init.headers.Authorization).toBe("Bearer test-token")
  })

  it("returns null when no docs match", async () => {
    const fetchMock = vi.fn<SanityFetch>(async () => jsonResponse(200, { result: null }))
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock })
    expect(await client.findByVoyantId("product", "missing")).toBeNull()
  })

  it("respects a custom voyantIdField", async () => {
    const fetchMock = vi.fn<SanityFetch>(async () => jsonResponse(200, { result: null }))
    const client = createSanityClient({
      ...baseOptions,
      voyantIdField: "externalId",
      fetch: fetchMock,
    })
    await client.findByVoyantId("product", "prod_1")
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain("externalId%20%3D%3D%20%24vid")
  })

  it("respects a custom apiVersion", async () => {
    const fetchMock = vi.fn<SanityFetch>(async () => jsonResponse(200, { result: null }))
    const client = createSanityClient({
      ...baseOptions,
      apiVersion: "2023-10-01",
      fetch: fetchMock,
    })
    await client.findByVoyantId("product", "prod_1")
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain("/v2023-10-01/data/query/production?")
  })

  it("respects a custom apiHost", async () => {
    const fetchMock = vi.fn<SanityFetch>(async () => jsonResponse(200, { result: null }))
    const client = createSanityClient({
      ...baseOptions,
      apiHost: "sanity.internal.example.com",
      fetch: fetchMock,
    })
    await client.findByVoyantId("product", "prod_1")
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain("https://abc123.sanity.internal.example.com/")
  })

  it("throws on non-2xx response (after exhausting retries)", async () => {
    const fetchMock = vi.fn<SanityFetch>(async () => textResponse(500, "boom"))
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock, resilience: fastRetry })
    await expect(client.findByVoyantId("product", "x")).rejects.toThrow(
      /Sanity findByVoyantId\(product\) failed \(500\)/,
    )
    // 5xx is retried; the final failing response is surfaced to error mapping.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe("createSanityClient.upsertByVoyantId", () => {
  it("creates a new doc when none exists", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: null }))
      .mockResolvedValueOnce(
        jsonResponse(200, { results: [{ id: "sn_new", operation: "create" }] }),
      )
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.upsertByVoyantId("product", "prod_1", { name: "X" })
    expect(result).toEqual({ _id: "sn_new", created: true })
    const createCall = fetchMock.mock.calls[1]!
    expect(createCall[0]).toContain(
      "https://abc123.api.sanity.io/v2024-01-01/data/mutate/production",
    )
    expect(createCall[0]).toContain("returnIds=true")
    expect(createCall[0]).toContain("visibility=sync")
    expect(createCall[1].method).toBe("POST")
    const body = JSON.parse(createCall[1].body ?? "{}")
    expect(body).toEqual({
      mutations: [
        {
          create: { _type: "product", name: "X", voyantId: "prod_1" },
        },
      ],
    })
  })

  it("updates an existing doc when found", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: { _id: "sn_existing" } }))
      .mockResolvedValueOnce(
        jsonResponse(200, { results: [{ id: "sn_existing", operation: "update" }] }),
      )
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock })
    const result = await client.upsertByVoyantId("product", "prod_1", { name: "Y" })
    expect(result).toEqual({ _id: "sn_existing", created: false })
    const patchCall = fetchMock.mock.calls[1]!
    expect(patchCall[1].method).toBe("POST")
    const body = JSON.parse(patchCall[1].body ?? "{}")
    expect(body).toEqual({
      mutations: [
        {
          patch: {
            id: "sn_existing",
            set: { name: "Y", voyantId: "prod_1" },
          },
        },
      ],
    })
  })

  it("throws if create response has no id", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: null }))
      .mockResolvedValueOnce(jsonResponse(200, { results: [] }))
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock })
    await expect(client.upsertByVoyantId("product", "p", {})).rejects.toThrow(/response missing id/)
  })

  it("throws on create error", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: null }))
      .mockResolvedValueOnce(textResponse(400, "bad request"))
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock })
    await expect(client.upsertByVoyantId("product", "p", {})).rejects.toThrow(
      /Sanity create\(product\) failed \(400\)/,
    )
  })

  it("throws on update error", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: { _id: "sn_1" } }))
      .mockResolvedValueOnce(textResponse(409, "conflict"))
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock })
    await expect(client.upsertByVoyantId("product", "p", {})).rejects.toThrow(
      /Sanity update\(product\/sn_1\) failed \(409\)/,
    )
  })
})

describe("createSanityClient.deleteByVoyantId", () => {
  it("deletes when doc exists", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: { _id: "sn_1" } }))
      .mockResolvedValueOnce(jsonResponse(200, { results: [{ id: "sn_1", operation: "delete" }] }))
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock })
    expect(await client.deleteByVoyantId("product", "p")).toBe(true)
    const deleteCall = fetchMock.mock.calls[1]!
    expect(deleteCall[1].method).toBe("POST")
    const body = JSON.parse(deleteCall[1].body ?? "{}")
    expect(body).toEqual({ mutations: [{ delete: { id: "sn_1" } }] })
  })

  it("returns false when doc does not exist", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: null }))
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock })
    expect(await client.deleteByVoyantId("product", "p")).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("throws on non-2xx delete response", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: { _id: "sn_1" } }))
      .mockResolvedValue(textResponse(500, "boom"))
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock, resilience: fastRetry })
    await expect(client.deleteByVoyantId("product", "p")).rejects.toThrow(
      /Sanity delete\(product\/sn_1\) failed \(500\)/,
    )
  })
})

describe("createSanityClient — resilience", () => {
  it("retries a 503 GET and succeeds on a later attempt", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(textResponse(503, "unavailable"))
      .mockResolvedValueOnce(jsonResponse(200, { result: { _id: "sn_1" } }))
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock, resilience: fastRetry })
    expect(await client.findByVoyantId("product", "p")).toEqual({ _id: "sn_1" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("retries the mutate POST (idempotent by construction via voyantId)", async () => {
    const fetchMock = vi
      .fn<SanityFetch>()
      .mockResolvedValueOnce(jsonResponse(200, { result: null }))
      .mockResolvedValueOnce(textResponse(503, "unavailable"))
      .mockResolvedValueOnce(
        jsonResponse(200, { results: [{ id: "sn_new", operation: "create" }] }),
      )
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock, resilience: fastRetry })
    expect(await client.upsertByVoyantId("product", "prod_1", { name: "X" })).toEqual({
      _id: "sn_new",
      created: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("does not retry 4xx responses", async () => {
    const fetchMock = vi.fn<SanityFetch>(async () => textResponse(400, "bad request"))
    const client = createSanityClient({ ...baseOptions, fetch: fetchMock, resilience: fastRetry })
    await expect(client.findByVoyantId("product", "p")).rejects.toThrow(/failed \(400\)/)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("fails fast with CircuitOpenError once the breaker trips", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1, openMs: 60_000 })
    const fetchMock = vi.fn<SanityFetch>(async () => textResponse(500, "down"))
    const client = createSanityClient({
      ...baseOptions,
      fetch: fetchMock,
      resilience: { breaker, retry: false },
    })

    await expect(client.findByVoyantId("product", "p")).rejects.toThrow(/failed \(500\)/)
    expect(fetchMock).toHaveBeenCalledOnce()

    // Breaker is open now: no network call, fail fast.
    await expect(client.findByVoyantId("product", "p")).rejects.toBeInstanceOf(CircuitOpenError)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe("createSanityClient — fetch handling", () => {
  it("throws when no fetch implementation is available", async () => {
    const originalFetch = globalThis.fetch
    // biome-ignore lint/suspicious/noExplicitAny: stubbing global fetch
    ;(globalThis as any).fetch = undefined
    try {
      // biome-ignore lint/suspicious/noExplicitAny: simulating missing fetch
      const client = createSanityClient({ ...baseOptions, fetch: undefined as any })
      await expect(client.findByVoyantId("product", "x")).rejects.toThrow(
        /requires a fetch implementation/,
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
