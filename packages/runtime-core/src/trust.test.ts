import { describe, expect, it } from "vitest"

import {
  constantTimeEqual,
  ORIGIN_TRUST_HEADER,
  originTrustMiddleware,
  verifyOriginTrust,
} from "./trust.js"

function req(headers: Record<string, string> = {}, path = "/v1/admin/x"): Request {
  return new Request(`https://app.example.com${path}`, { headers })
}

describe("constantTimeEqual", () => {
  it("returns true for equal strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true)
  })
  it("returns false for different values and lengths", () => {
    expect(constantTimeEqual("abc", "abd")).toBe(false)
    expect(constantTimeEqual("abc", "abcd")).toBe(false)
    expect(constantTimeEqual("", "x")).toBe(false)
  })
})

describe("verifyOriginTrust", () => {
  it("passes when the header matches the secret", () => {
    expect(verifyOriginTrust(req({ [ORIGIN_TRUST_HEADER]: "s3cr3t" }), "s3cr3t")).toBe(true)
  })
  it("fails when header is missing or wrong", () => {
    expect(verifyOriginTrust(req(), "s3cr3t")).toBe(false)
    expect(verifyOriginTrust(req({ [ORIGIN_TRUST_HEADER]: "nope" }), "s3cr3t")).toBe(false)
  })
})

describe("originTrustMiddleware", () => {
  it("rejects unauthenticated requests with 403", () => {
    const gate = originTrustMiddleware("s3cr3t")
    const rejection = gate(req())
    expect(rejection?.status).toBe(403)
  })

  it("allows authenticated requests through (undefined)", () => {
    const gate = originTrustMiddleware("s3cr3t")
    expect(gate(req({ [ORIGIN_TRUST_HEADER]: "s3cr3t" }))).toBeUndefined()
  })

  it("exempts configured paths", () => {
    const gate = originTrustMiddleware("s3cr3t", { exemptPaths: ["/healthz"] })
    expect(gate(req({}, "/healthz"))).toBeUndefined()
  })

  it("uses the pinned header name", () => {
    expect(ORIGIN_TRUST_HEADER).toBe("x-voyant-origin-trust")
  })
})
