import { createDbClient } from "@voyant-travel/db"
import { customerAuthSession, customerAuthUser } from "@voyant-travel/db/schema/iam"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { isCustomerSessionActive } from "../../src/local-member-access.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

describe.skipIf(!TEST_DATABASE_URL)("customer session liveness integration", () => {
  const db = createDbClient(TEST_DATABASE_URL!, {
    adapter: "node",
    nodeMaxConnections: 2,
    timeouts: { connectMs: false, queryMs: false, statementMs: false },
  })

  beforeEach(async () => {
    await db.delete(customerAuthUser)
  })

  afterAll(async () => {
    await db.$client.end({ timeout: 0 })
  })

  it("rejects expired and deleted customer sessions even when a cookie still names them", async () => {
    const now = new Date()
    await db.insert(customerAuthUser).values({
      id: "customer-session-user",
      name: "Customer",
      email: "customer-session@example.com",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(customerAuthSession).values([
      {
        id: "live-customer-session",
        token: "live-customer-session-token",
        userId: "customer-session-user",
        expiresAt: new Date(now.getTime() + 60_000),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "expired-customer-session",
        token: "expired-customer-session-token",
        userId: "customer-session-user",
        expiresAt: new Date(now.getTime() - 60_000),
        createdAt: now,
        updatedAt: now,
      },
    ])

    await expect(
      isCustomerSessionActive(db, "live-customer-session", "customer-session-user"),
    ).resolves.toBe(true)
    await expect(
      isCustomerSessionActive(db, "expired-customer-session", "customer-session-user"),
    ).resolves.toBe(false)

    await db.delete(customerAuthUser)
    await expect(
      isCustomerSessionActive(db, "live-customer-session", "customer-session-user"),
    ).resolves.toBe(false)
  })
})
