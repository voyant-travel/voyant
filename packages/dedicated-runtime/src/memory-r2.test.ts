import { describe, expect, it } from "vitest"

import { createMemoryR2Bucket } from "./memory-r2.js"

describe("createMemoryR2Bucket", () => {
  it("puts and gets an object with metadata", async () => {
    const bucket = createMemoryR2Bucket()
    await bucket.put("docs/a.txt", "hello", {
      httpMetadata: { contentType: "text/plain" },
      customMetadata: { owner: "u1" },
    })
    const object = await bucket.get("docs/a.txt")
    expect(object).not.toBeNull()
    expect(new TextDecoder().decode(await object!.arrayBuffer())).toBe("hello")
    expect(object!.httpMetadata?.contentType).toBe("text/plain")
    expect(object!.customMetadata?.owner).toBe("u1")
    expect(object!.size).toBe(5)
  })

  it("returns only the stored view's bytes when put a subarray of a larger buffer", async () => {
    const bucket = createMemoryR2Bucket()
    const backing = new Uint8Array([1, 2, 3, 4, 5, 6])
    await bucket.put("k", backing.subarray(2, 4)) // [3, 4], offset into a 6-byte buffer
    const object = await bucket.get("k")
    expect(new Uint8Array(await object!.arrayBuffer())).toEqual(new Uint8Array([3, 4]))
    expect(object!.size).toBe(2)
  })

  it("returns null for a missing object", async () => {
    const bucket = createMemoryR2Bucket()
    expect(await bucket.get("missing")).toBeNull()
    expect(await bucket.head("missing")).toBeNull()
  })

  it("heads without the body", async () => {
    const bucket = createMemoryR2Bucket()
    await bucket.put("k", "abc")
    const head = await bucket.head("k")
    expect(head?.size).toBe(3)
  })

  it("deletes one and many keys", async () => {
    const bucket = createMemoryR2Bucket()
    await bucket.put("a", "1")
    await bucket.put("b", "2")
    await bucket.delete("a")
    await bucket.delete(["b"])
    expect(await bucket.get("a")).toBeNull()
    expect(await bucket.get("b")).toBeNull()
  })
})
