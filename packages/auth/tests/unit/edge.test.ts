import { createHmac } from "node:crypto"
import { describe, expect, it, vi } from "vitest"

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }))

vi.mock("@voyant-travel/db", () => ({ getDb: getDbMock }))

import { getAuthContextFromHeaders } from "../../src/edge.js"

describe("getAuthContextFromHeaders", () => {
  it("does not accept the legacy Better Auth secret for the admin realm", async () => {
    const originalAdminAuthSecret = process.env.BETTER_AUTH_ADMIN_SECRET
    const originalBetterAuthSecret = process.env.BETTER_AUTH_SECRET
    const token = "legacy-admin-session"
    const legacySecret = "legacy-secret".repeat(4)
    const signature = createHmac("sha256", legacySecret).update(token).digest("base64")

    try {
      delete process.env.BETTER_AUTH_ADMIN_SECRET
      process.env.BETTER_AUTH_SECRET = legacySecret

      await expect(
        getAuthContextFromHeaders(
          new Headers({
            cookie: `voyant-admin.session_token=${encodeURIComponent(`${token}.${signature}`)}`,
          }),
        ),
      ).resolves.toEqual({ userId: null, email: null, sessionId: null })
      expect(getDbMock).not.toHaveBeenCalled()
    } finally {
      if (originalAdminAuthSecret === undefined) delete process.env.BETTER_AUTH_ADMIN_SECRET
      else process.env.BETTER_AUTH_ADMIN_SECRET = originalAdminAuthSecret
      if (originalBetterAuthSecret === undefined) delete process.env.BETTER_AUTH_SECRET
      else process.env.BETTER_AUTH_SECRET = originalBetterAuthSecret
    }
  })
})
