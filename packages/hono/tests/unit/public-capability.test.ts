import { describe, expect, it } from "vitest"

import {
  createPublicCapabilityToken,
  verifyPublicCapabilityToken,
} from "../../src/public-capability.js"
import { ForbiddenApiError, UnauthorizedApiError } from "../../src/validation.js"

const SECRET = "checkout-capability-test-secret-32chars"

describe("public capability tokens", () => {
  it("verifies a scoped action for the intended subject", async () => {
    const issued = await createPublicCapabilityToken({
      secret: SECRET,
      scope: "booking-checkout-session",
      subjectId: "book_123",
      actions: ["session:read", "session:update"],
      ttlSeconds: 60,
      now: new Date("2026-05-11T00:00:00.000Z"),
    })

    await expect(
      verifyPublicCapabilityToken(issued.token, {
        secret: SECRET,
        scope: "booking-checkout-session",
        subjectId: "book_123",
        action: "session:update",
        now: new Date("2026-05-11T00:00:30.000Z"),
      }),
    ).resolves.toMatchObject({
      scope: "booking-checkout-session",
      subjectId: "book_123",
    })
  })

  it("rejects a token presented for another subject", async () => {
    const issued = await createPublicCapabilityToken({
      secret: SECRET,
      scope: "booking-checkout-session",
      subjectId: "book_123",
      actions: ["session:read"],
      ttlSeconds: 60,
      now: new Date("2026-05-11T00:00:00.000Z"),
    })

    await expect(
      verifyPublicCapabilityToken(issued.token, {
        secret: SECRET,
        scope: "booking-checkout-session",
        subjectId: "book_456",
        action: "session:read",
        now: new Date("2026-05-11T00:00:30.000Z"),
      }),
    ).rejects.toBeInstanceOf(ForbiddenApiError)
  })

  it("rejects actions outside the token grant", async () => {
    const issued = await createPublicCapabilityToken({
      secret: SECRET,
      scope: "booking-checkout-session",
      subjectId: "book_123",
      actions: ["session:read"],
      ttlSeconds: 60,
      now: new Date("2026-05-11T00:00:00.000Z"),
    })

    await expect(
      verifyPublicCapabilityToken(issued.token, {
        secret: SECRET,
        scope: "booking-checkout-session",
        subjectId: "book_123",
        action: "session:update",
        now: new Date("2026-05-11T00:00:30.000Z"),
      }),
    ).rejects.toBeInstanceOf(ForbiddenApiError)
  })

  it("rejects expired tokens", async () => {
    const issued = await createPublicCapabilityToken({
      secret: SECRET,
      scope: "booking-checkout-session",
      subjectId: "book_123",
      actions: ["session:read"],
      ttlSeconds: 60,
      now: new Date("2026-05-11T00:00:00.000Z"),
    })

    await expect(
      verifyPublicCapabilityToken(issued.token, {
        secret: SECRET,
        scope: "booking-checkout-session",
        subjectId: "book_123",
        action: "session:read",
        now: new Date("2026-05-11T00:02:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedApiError)
  })
})
