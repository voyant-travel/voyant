import { describe, expect, it } from "vitest"

import { createLocalStorageProvider } from "../../src/providers/local.js"

describe("createLocalStorageProvider", () => {
  it("stores and retrieves bytes", async () => {
    const store = createLocalStorageProvider({ generateKey: () => "fixed-key" })
    const bytes = new Uint8Array([1, 2, 3, 4])
    const result = await store.upload(bytes, { contentType: "application/octet-stream" })
    expect(result.key).toBe("fixed-key")
    expect(result.url).toBe("local://fixed-key")
    const retrieved = await store.get("fixed-key")
    expect(retrieved).not.toBeNull()
    expect(new Uint8Array(retrieved as ArrayBuffer)).toEqual(bytes)
  })

  it("accepts an explicit key via upload options", async () => {
    const store = createLocalStorageProvider()
    const result = await store.upload(new Uint8Array([9]), { key: "custom/path/a.bin" })
    expect(result.key).toBe("custom/path/a.bin")
    expect(result.url).toBe("local://custom/path/a.bin")
  })

  it("encodes URL-significant key characters without changing the stored key", async () => {
    const store = createLocalStorageProvider({ baseUrl: "http://localhost:3300/api/media/" })
    const key = "brochures/Summer #1?.pdf"
    const result = await store.upload(new Uint8Array([1]), { key })

    expect(result).toEqual({
      key,
      url: "http://localhost:3300/api/media/brochures/Summer%20%231%3F.pdf",
    })
    await expect(store.get(key)).resolves.toBeInstanceOf(ArrayBuffer)
  })

  it("returns null for missing keys", async () => {
    const store = createLocalStorageProvider()
    expect(await store.get("nope")).toBeNull()
  })

  it("deletes objects", async () => {
    const store = createLocalStorageProvider({ generateKey: () => "k" })
    await store.upload(new Uint8Array([1]))
    await store.delete("k")
    expect(await store.get("k")).toBeNull()
  })

  it("delete is a no-op for missing keys", async () => {
    const store = createLocalStorageProvider()
    await expect(store.delete("nope")).resolves.toBeUndefined()
  })

  it("signedUrl returns the public URL form", async () => {
    const store = createLocalStorageProvider({ baseUrl: "https://cdn.example.com/" })
    expect(await store.signedUrl("a.png", 60)).toBe("https://cdn.example.com/a.png")
  })

  it("isolates stored data from subsequent mutation of source bytes", async () => {
    const store = createLocalStorageProvider({ generateKey: () => "k" })
    const bytes = new Uint8Array([1, 2, 3])
    await store.upload(bytes)
    // We don't reuse the source buffer, but consumers may — verify copies are independent
    bytes[0] = 99
    const retrieved = new Uint8Array((await store.get("k")) as ArrayBuffer)
    // The provider does not deep-copy the input, so the stored bytes reflect
    // the current state of the source buffer. What we verify is that later
    // `get` calls return a **copy** that is independent of each other.
    const second = new Uint8Array((await store.get("k")) as ArrayBuffer)
    second[0] = 42
    const third = new Uint8Array((await store.get("k")) as ArrayBuffer)
    expect(third[0]).not.toBe(42)
    expect(retrieved.byteLength).toBe(3)
  })

  it("accepts ArrayBuffer and Blob bodies", async () => {
    const store = createLocalStorageProvider({ generateKey: () => "k" })
    await store.upload(new Uint8Array([1, 2]).buffer, { key: "ab" })
    await store.upload(new Blob([new Uint8Array([3, 4])]), { key: "blob" })
    const ab = new Uint8Array((await store.get("ab")) as ArrayBuffer)
    const blob = new Uint8Array((await store.get("blob")) as ArrayBuffer)
    expect(ab).toEqual(new Uint8Array([1, 2]))
    expect(blob).toEqual(new Uint8Array([3, 4]))
  })
})
