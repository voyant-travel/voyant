import { describe, expect, it } from "vitest"

import { redactHeaders } from "../../src/webhook-deliveries.js"

describe("redactHeaders", () => {
  it("returns null for undefined", () => {
    expect(redactHeaders(undefined)).toBeNull()
  })

  it("redacts well-known auth headers (case-insensitive)", () => {
    const input = {
      Authorization: "Bearer xxx",
      authorization: "Basic yyy",
      "X-Api-Key": "abc123",
      "x-api-token": "tok",
      "Set-Cookie": "session=zzz",
      cookie: "id=42",
      "Content-Type": "application/json",
      "User-Agent": "voyant-channel-push/1.0",
    }
    const out = redactHeaders(input)
    expect(out).toEqual({
      Authorization: "[REDACTED]",
      authorization: "[REDACTED]",
      "X-Api-Key": "[REDACTED]",
      "x-api-token": "[REDACTED]",
      "Set-Cookie": "[REDACTED]",
      cookie: "[REDACTED]",
      "Content-Type": "application/json",
      "User-Agent": "voyant-channel-push/1.0",
    })
  })

  it("preserves header name casing on redacted entries", () => {
    const out = redactHeaders({ AUTHORIZATION: "x" })
    expect(out).toHaveProperty("AUTHORIZATION", "[REDACTED]")
  })

  it("returns an empty object for empty input (not null)", () => {
    expect(redactHeaders({})).toEqual({})
  })
})
