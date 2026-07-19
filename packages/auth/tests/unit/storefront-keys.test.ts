import { describe, expect, it } from "vitest"

import {
  classifyStorefrontApiKey,
  generateStorefrontApiKey,
  hashStorefrontApiKey,
} from "../../src/storefront-keys.js"

describe("storefront access keys", () => {
  it("mints publishable keys with the vpk_ prefix and a stored hash", async () => {
    const key = await generateStorefrontApiKey("publishable")
    expect(key.kind).toBe("publishable")
    expect(key.token.startsWith("vpk_")).toBe(true)
    expect(key.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(key.tokenHash).toBe(await hashStorefrontApiKey(key.token))
    expect(key.tokenPreview).toBe(key.token.slice(0, "vpk_".length + 6))
    expect(key.token.startsWith(key.tokenPreview)).toBe(true)
  })

  it("mints secret keys with the vsk_ prefix", async () => {
    const key = await generateStorefrontApiKey("secret")
    expect(key.kind).toBe("secret")
    expect(key.token.startsWith("vsk_")).toBe(true)
  })

  it("never repeats a token or its hash", async () => {
    const [a, b] = await Promise.all([
      generateStorefrontApiKey("publishable"),
      generateStorefrontApiKey("publishable"),
    ])
    expect(a.token).not.toBe(b.token)
    expect(a.tokenHash).not.toBe(b.tokenHash)
  })

  it("classifies tokens by prefix and rejects foreign tokens", () => {
    expect(classifyStorefrontApiKey("vpk_abc")).toBe("publishable")
    expect(classifyStorefrontApiKey("vsk_abc")).toBe("secret")
    expect(classifyStorefrontApiKey("sk_live_abc")).toBeNull()
    expect(classifyStorefrontApiKey("")).toBeNull()
  })

  it("hashes deterministically", async () => {
    expect(await hashStorefrontApiKey("vpk_fixed-token")).toBe(
      await hashStorefrontApiKey("vpk_fixed-token"),
    )
    expect(await hashStorefrontApiKey("vpk_a")).not.toBe(await hashStorefrontApiKey("vpk_b"))
  })
})
