import { describe, expect, it } from "vitest"

import { createLocalStorageProvider } from "../../src/providers/local.js"
import { createStorageService } from "../../src/service.js"

describe("createStorageService", () => {
  it("wraps a single provider and delegates all calls", async () => {
    const provider = createLocalStorageProvider({ generateKey: () => "k" })
    const service = createStorageService(provider)

    const uploaded = await service.upload(new Uint8Array([1, 2, 3]), {
      contentType: "application/octet-stream",
    })
    expect(uploaded.key).toBe("k")
    expect(service.name).toBe("memory")

    const bytes = await service.get("k")
    expect(bytes).not.toBeNull()
    expect(new Uint8Array(bytes as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]))

    expect(await service.signedUrl("k", 60)).toBe("local://k")
    await service.delete("k")
    expect(await service.get("k")).toBeNull()
  })

  it("exposes the wrapped provider", () => {
    const provider = createLocalStorageProvider()
    const service = createStorageService(provider)
    expect(service.provider).toBe(provider)
  })
})
