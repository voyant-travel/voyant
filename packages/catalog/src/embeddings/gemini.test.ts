import { describe, expect, it, vi } from "vitest"

import { EMBEDDING_BATCH_TOO_LARGE, EmbeddingProviderError } from "./contract.js"
import { createGeminiEmbeddingProvider, GEMINI_MODELS } from "./gemini.js"

function mockFetch(response: {
  ok: boolean
  status?: number
  json?: () => Promise<unknown>
}): typeof fetch {
  return vi.fn<typeof globalThis.fetch>(async () => {
    return new Response(
      typeof response.json === "function" ? JSON.stringify(await response.json()) : "",
      {
        status: response.status ?? (response.ok ? 200 : 400),
      },
    )
  })
}

function firstFetchCall(
  fetchSpy: ReturnType<typeof vi.fn<typeof globalThis.fetch>>,
): Parameters<typeof globalThis.fetch> {
  const call = fetchSpy.mock.calls[0]
  expect(call).toBeDefined()
  return call!
}

function firstFetchInit(fetchSpy: ReturnType<typeof vi.fn<typeof globalThis.fetch>>): RequestInit {
  const init = firstFetchCall(fetchSpy)[1]
  expect(init).toBeDefined()
  return init!
}

describe("createGeminiEmbeddingProvider", () => {
  it("declares correct capabilities for the default model", () => {
    const provider = createGeminiEmbeddingProvider({
      apiKey: "key",
      fetchImpl: mockFetch({ ok: true, json: async () => ({ embeddings: [] }) }),
    })
    expect(provider.capabilities.modelId).toBe("gemini/gemini-embedding-001/v1")
    expect(provider.capabilities.dimensions).toBe(3072)
    expect(provider.capabilities.maxBatchSize).toBe(100)
  })

  it("honors outputDimensionality on MRL-capable models", () => {
    const provider = createGeminiEmbeddingProvider({
      apiKey: "key",
      outputDimensionality: 768,
      fetchImpl: mockFetch({ ok: true, json: async () => ({ embeddings: [] }) }),
    })
    expect(provider.capabilities.dimensions).toBe(768)
  })

  it("ignores outputDimensionality on legacy text-embedding-004", () => {
    const provider = createGeminiEmbeddingProvider({
      apiKey: "key",
      model: "text-embedding-004",
      outputDimensionality: 1536,
      fetchImpl: mockFetch({ ok: true, json: async () => ({ embeddings: [] }) }),
    })
    expect(provider.capabilities.dimensions).toBe(GEMINI_MODELS["text-embedding-004"].dimensions)
  })

  it("returns vectors in input order from a batch response", async () => {
    const provider = createGeminiEmbeddingProvider({
      apiKey: "key",
      fetchImpl: mockFetch({
        ok: true,
        json: async () => ({
          embeddings: [{ values: [0.1] }, { values: [0.2] }, { values: [0.3] }],
        }),
      }),
    })
    const vectors = await provider.embed(["a", "b", "c"])
    expect(vectors).toEqual([[0.1], [0.2], [0.3]])
  })

  it("returns an empty array for empty input without hitting the API", async () => {
    const fetchSpy = vi.fn<typeof globalThis.fetch>()
    const provider = createGeminiEmbeddingProvider({ apiKey: "key", fetchImpl: fetchSpy })
    expect(await provider.embed([])).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("throws EMBEDDING_BATCH_TOO_LARGE when input exceeds maxBatchSize", async () => {
    const provider = createGeminiEmbeddingProvider({
      apiKey: "key",
      fetchImpl: mockFetch({ ok: true, json: async () => ({ embeddings: [] }) }),
    })
    const tooMany = Array.from({ length: 101 }, (_, i) => `t-${i}`)
    await expect(provider.embed(tooMany)).rejects.toMatchObject({
      code: EMBEDDING_BATCH_TOO_LARGE,
    })
  })

  it("wraps non-2xx responses as EmbeddingProviderError", async () => {
    const provider = createGeminiEmbeddingProvider({
      apiKey: "key",
      fetchImpl: mockFetch({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 401, message: "API key not valid" } }),
      }),
    })
    await expect(provider.embed(["x"])).rejects.toBeInstanceOf(EmbeddingProviderError)
  })

  it("sends the api key as x-goog-api-key header", async () => {
    const fetchSpy = vi.fn<typeof globalThis.fetch>(async () => {
      return new Response(JSON.stringify({ embeddings: [{ values: [0.1] }] }), { status: 200 })
    })
    const provider = createGeminiEmbeddingProvider({ apiKey: "key-xyz", fetchImpl: fetchSpy })
    await provider.embed(["x"])
    const init = firstFetchInit(fetchSpy)
    const headers = init.headers as Record<string, string>
    expect(headers["x-goog-api-key"]).toBe("key-xyz")
  })

  it("uses Bearer auth when auth mode is 'bearer' (Voyant Cloud gateway)", async () => {
    const fetchSpy = vi.fn<typeof globalThis.fetch>(async () => {
      return new Response(JSON.stringify({ embeddings: [{ values: [0] }] }), { status: 200 })
    })
    const provider = createGeminiEmbeddingProvider({
      apiKey: "vc-token-abc",
      auth: "bearer",
      baseUrl: "https://api.voyant.travel/ai/v1/gemini",
      fetchImpl: fetchSpy,
    })
    await provider.embed(["x"])
    const [url] = firstFetchCall(fetchSpy)
    const init = firstFetchInit(fetchSpy)
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer vc-token-abc")
    expect(headers["x-goog-api-key"]).toBeUndefined()
    expect(url).toBe(
      "https://api.voyant.travel/ai/v1/gemini/models/gemini-embedding-001:batchEmbedContents",
    )
  })

  it("passes outputDimensionality + taskType in each request body", async () => {
    const fetchSpy = vi.fn<typeof globalThis.fetch>(async () => {
      return new Response(JSON.stringify({ embeddings: [{ values: [0] }] }), { status: 200 })
    })
    const provider = createGeminiEmbeddingProvider({
      apiKey: "key",
      outputDimensionality: 768,
      taskType: "RETRIEVAL_QUERY",
      fetchImpl: fetchSpy,
    })
    await provider.embed(["q"])
    const init = firstFetchInit(fetchSpy)
    const body = JSON.parse(String(init.body))
    expect(body.requests[0].outputDimensionality).toBe(768)
    expect(body.requests[0].taskType).toBe("RETRIEVAL_QUERY")
  })
})
