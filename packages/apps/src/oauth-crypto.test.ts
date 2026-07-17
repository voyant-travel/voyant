import { describe, expect, it } from "vitest"
import { sha256Base64Url, verifyPkceS256 } from "./oauth-crypto.js"

describe("app OAuth PKCE", () => {
  it("accepts only S256 challenges derived from the verifier", () => {
    const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ_0123456789-1234567890"
    const challenge = sha256Base64Url(verifier)

    expect(verifyPkceS256(verifier, challenge)).toBe(true)
    expect(verifyPkceS256(`${verifier}x`, challenge)).toBe(false)
    expect(verifyPkceS256("too-short", challenge)).toBe(false)
  })
})
