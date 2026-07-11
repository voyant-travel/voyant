import { describe, expect, it } from "vitest"

import {
  hashWebhookPayload,
  redactWebhookHeaders,
  signWebhookPayload,
  webhookBodyExcerpt,
} from "../src/security.js"

describe("webhook delivery security", () => {
  it("uses a versioned SHA-256 HMAC signature", () => {
    expect(signWebhookPayload("secret", "123", '{"ok":true}')).toMatch(/^sha256=[a-f0-9]{64}$/)
  })

  it("uses a cryptographic body fingerprint", () => {
    expect(hashWebhookPayload("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    )
  })

  it("redacts credentials and PII from persisted audit fields", () => {
    expect(
      redactWebhookHeaders({ Authorization: "secret", "x-voyant-signature": "signature" }),
    ).toEqual({ Authorization: "[REDACTED]", "x-voyant-signature": "[REDACTED]" })
    expect(webhookBodyExcerpt('{"email":"private@example.test","bookingId":"book_1"}')).toBe(
      '{"email":"[REDACTED]","bookingId":"book_1"}',
    )
  })

  it("bounds persisted excerpts", () => {
    expect(
      Buffer.byteLength(webhookBodyExcerpt("x".repeat(10_000)) ?? "", "utf8"),
    ).toBeLessThanOrEqual(4 * 1024)
  })
})
