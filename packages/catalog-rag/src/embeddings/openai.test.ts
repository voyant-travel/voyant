import { describe, expect, it, vi } from "vitest"

import { EMBEDDING_BATCH_TOO_LARGE, EmbeddingProviderError } from "./contract.js"
import { createOpenAIEmbeddingProvider, embedBatched, OPENAI_MODELS } from "./openai.js"

function mockFetch(response: {
  ok: boolean
  status?: number
  json?: () => Promise<unknown>
  text?: () => Promise<string>
}): typeof fetch {
  return vi.fn(async () => {
    return new Response(
      typeof response.json === "function" ? JSON.stringify(await response.json()) : "",
      {
        status: response.status ?? (response.ok ? 200 : 400),
      },
    )
  }) as unknown as typeof fetch
}

describe("createOpenAIEmbeddingProvider", () => {
  it("declares correct capabilities for the default model", () => {
    const provider = createOpenAIEmbeddingProvider({
      apiKey: "sk-test",
      fetchImpl: mockFetch({ ok: true, json: async () => ({ data: [] }) }),
    })
    expect(provider.capabilities.modelId).toBe("openai/text-embedding-3-small/v1")
    expect(provider.capabilities.dimensions).toBe(1536)
    expect(provider.capabilities.maxBatchSize).toBe(2048)
  })

  it("uses the configured model and stamps a matching modelId", () => {
    const provider = createOpenAIEmbeddingProvider({
      apiKey: "sk-test",
      model: "text-embedding-3-large",
      fetchImpl: mockFetch({ ok: true, json: async () => ({ data: [] }) }),
    })
    expect(provider.capabilities.modelId).toBe("openai/text-embedding-3-large/v1")
    expect(provider.capabilities.dimensions).toBe(
      OPENAI_MODELS["text-embedding-3-large"].dimensions,
    )
  })

  it("returns vectors in input order even when API returns shuffled indices", async () => {
    const provider = createOpenAIEmbeddingProvider({
      apiKey: "sk-test",
      fetchImpl: mockFetch({
        ok: true,
        json: async () => ({
          object: "list",
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 5, total_tokens: 5 },
          data: [
            { object: "embedding", index: 2, embedding: [0.3] },
            { object: "embedding", index: 0, embedding: [0.1] },
            { object: "embedding", index: 1, embedding: [0.2] },
          ],
        }),
      }),
    })
    const vectors = await provider.embed(["a", "b", "c"])
    expect(vectors).toEqual([[0.1], [0.2], [0.3]])
  })

  it("returns an empty array for an empty input without hitting the API", async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch
    const provider = createOpenAIEmbeddingProvider({ apiKey: "sk-test", fetchImpl: fetchSpy })
    const vectors = await provider.embed([])
    expect(vectors).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("throws EMBEDDING_BATCH_TOO_LARGE when input exceeds maxBatchSize", async () => {
    const provider = createOpenAIEmbeddingProvider({
      apiKey: "sk-test",
      fetchImpl: mockFetch({ ok: true, json: async () => ({ data: [] }) }),
    })
    const tooMany = Array.from({ length: 2049 }, (_, i) => `text-${i}`)
    await expect(provider.embed(tooMany)).rejects.toMatchObject({
      code: EMBEDDING_BATCH_TOO_LARGE,
    })
  })

  it("wraps non-2xx responses as EmbeddingProviderError", async () => {
    const provider = createOpenAIEmbeddingProvider({
      apiKey: "sk-test",
      fetchImpl: mockFetch({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "invalid api key", code: "invalid_api_key" } }),
      }),
    })
    await expect(provider.embed(["x"])).rejects.toBeInstanceOf(EmbeddingProviderError)
  })

  it("respects a custom baseUrl (Azure / proxy / OpenRouter)", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    }) as unknown as typeof fetch

    const provider = createOpenAIEmbeddingProvider({
      apiKey: "sk-test",
      baseUrl: "https://my-proxy.example.com/openai/v1/",
      fetchImpl: fetchSpy,
    })
    await provider.embed(["x"])
    // biome-ignore lint/suspicious/noExplicitAny: vi.fn return type
    const calledWith = (fetchSpy as any).mock.calls[0]?.[0]
    // Trailing slash stripped; path appended.
    expect(calledWith).toBe("https://my-proxy.example.com/openai/v1/embeddings")
  })

  it("sends the api key as a Bearer header", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    }) as unknown as typeof fetch
    const provider = createOpenAIEmbeddingProvider({
      apiKey: "sk-test-12345",
      fetchImpl: fetchSpy,
    })
    await provider.embed(["x"])
    // biome-ignore lint/suspicious/noExplicitAny: vi.fn return type
    const init = (fetchSpy as any).mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer sk-test-12345")
  })
})

describe("embedBatched", () => {
  it("returns results unchanged when input fits in a single batch", async () => {
    const provider = createOpenAIEmbeddingProvider({
      apiKey: "sk-test",
      fetchImpl: mockFetch({
        ok: true,
        json: async () => ({
          data: [
            { index: 0, embedding: [0.1] },
            { index: 1, embedding: [0.2] },
          ],
        }),
      }),
    })
    const result = await embedBatched(provider, ["a", "b"])
    expect(result).toEqual([[0.1], [0.2]])
  })

  it("chunks oversized inputs into batches and concatenates the results", async () => {
    let callCount = 0
    const fetchImpl = vi.fn(async () => {
      callCount++
      // Return one fake vector per input for whatever batch came in.
      return new Response(
        JSON.stringify({
          data: [
            { index: 0, embedding: [callCount * 0.1] },
            { index: 1, embedding: [callCount * 0.1 + 0.01] },
          ],
        }),
        { status: 200 },
      )
    }) as unknown as typeof fetch

    const provider = createOpenAIEmbeddingProvider({
      apiKey: "sk-test",
      fetchImpl,
      // Override capabilities by using a baseUrl trick? Easier: use the
      // default model and pass exactly maxBatchSize+ items. But that's
      // 2048+ which is unwieldy. Instead, since we control `embedBatched`'s
      // chunking via `provider.capabilities.maxBatchSize`, fake a smaller
      // batch size by constructing a minimal stub provider.
    })
    // Tweak capabilities for the test: replace with a tiny-batch-size proxy.
    const tinyBatchProvider = {
      capabilities: { ...provider.capabilities, maxBatchSize: 2 },
      embed: provider.embed.bind(provider),
    }

    const result = await embedBatched(tinyBatchProvider, ["a", "b", "c", "d"])
    // Two batches × 2 vectors each = 4 vectors total.
    expect(result).toHaveLength(4)
    // biome-ignore lint/suspicious/noExplicitAny: vi.fn type
    expect((fetchImpl as any).mock.calls.length).toBe(2)
  })
})
