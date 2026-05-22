import { describe, expect, it, vi } from "vitest"

import type { R2BucketLike } from "../../src/providers/r2.js"
import { createR2Provider } from "../../src/providers/r2.js"

function fakeBucket(): R2BucketLike & {
  store: Map<string, { bytes: Uint8Array; options: unknown }>
} {
  const store = new Map<string, { bytes: Uint8Array; options: unknown }>()
  return {
    store,
    put: vi.fn(async (key, value, options) => {
      let bytes: Uint8Array
      if (value instanceof Uint8Array) bytes = value
      else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value)
      else if (value instanceof Blob) bytes = new Uint8Array(await value.arrayBuffer())
      else bytes = new Uint8Array()
      store.set(key, { bytes, options })
      return { etag: "etag" }
    }),
    delete: vi.fn(async (key) => {
      if (typeof key === "string") store.delete(key)
    }),
    get: vi.fn(async (key) => {
      const record = store.get(key)
      if (!record) return null
      return { arrayBuffer: async () => record.bytes.buffer.slice(0) }
    }),
  }
}

describe("createR2Provider", () => {
  it("uploads via the R2 binding and returns a public URL", async () => {
    const bucket = fakeBucket()
    const provider = createR2Provider({
      bucket,
      publicBaseUrl: "https://cdn.example.com/",
      generateKey: () => "abc",
    })
    const result = await provider.upload(new Uint8Array([1, 2, 3]), {
      contentType: "image/png",
      metadata: { alt: "hero" },
    })
    expect(bucket.put).toHaveBeenCalledOnce()
    expect(bucket.put).toHaveBeenCalledWith(
      "abc",
      expect.anything(),
      expect.objectContaining({
        httpMetadata: { contentType: "image/png" },
        customMetadata: { alt: "hero" },
      }),
    )
    expect(result.key).toBe("abc")
    expect(result.url).toBe("https://cdn.example.com/abc")
  })

  it("returns an empty URL when no publicBaseUrl is set", async () => {
    const bucket = fakeBucket()
    const provider = createR2Provider({ bucket, generateKey: () => "k" })
    const result = await provider.upload(new Uint8Array())
    expect(result.url).toBe("")
  })

  it("delete delegates to the bucket", async () => {
    const bucket = fakeBucket()
    const provider = createR2Provider({ bucket })
    await provider.delete("a.png")
    expect(bucket.delete).toHaveBeenCalledWith("a.png")
  })

  it("get returns the object bytes or null", async () => {
    const bucket = fakeBucket()
    const provider = createR2Provider({ bucket, generateKey: () => "k" })
    await provider.upload(new Uint8Array([7, 8, 9]))
    const bytes = await provider.get("k")
    expect(bytes).not.toBeNull()
    expect(new Uint8Array(bytes as ArrayBuffer)).toEqual(new Uint8Array([7, 8, 9]))
    expect(await provider.get("missing")).toBeNull()
  })

  it("signedUrl uses the custom signer when provided", async () => {
    const bucket = fakeBucket()
    const signer = vi.fn(async (key: string, exp: number) => `signed://${key}?e=${exp}`)
    const provider = createR2Provider({ bucket, signer })
    expect(await provider.signedUrl("k", 120)).toBe("signed://k?e=120")
    expect(signer).toHaveBeenCalledWith("k", 120)
  })

  it("signedUrl falls back to publicBaseUrl when no signer is set", async () => {
    const bucket = fakeBucket()
    const provider = createR2Provider({
      bucket,
      publicBaseUrl: "https://cdn.example.com/",
    })
    expect(await provider.signedUrl("k", 60)).toBe("https://cdn.example.com/k")
  })

  it("signedUrl throws when neither publicBaseUrl nor signer is configured", async () => {
    const bucket = fakeBucket()
    const provider = createR2Provider({ bucket })

    await expect(provider.signedUrl("file.pdf", 300)).rejects.toThrow(
      "R2 provider: signedUrl requires either `publicBaseUrl` or `signer` to be configured",
    )
  })
})
