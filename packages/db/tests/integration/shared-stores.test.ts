import { sql } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import {
  createPostgresFixedWindowRateLimitStore,
  createPostgresKvStore,
} from "../../src/runtime/index.js"
import { cleanupTestDb, createTestDb } from "../../src/test-utils.js"

const describeIfDb: typeof describe = describe.skipIf(
  !process.env.TEST_DATABASE_URL,
) as typeof describe

async function ensureSharedStoreTables() {
  const db = createTestDb()
  await db.execute(sql`
    CREATE UNLOGGED TABLE IF NOT EXISTS kv_store (
      key text PRIMARY KEY,
      value text NOT NULL,
      expires_at timestamp with time zone,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `)
  await db.execute(sql`
    CREATE UNLOGGED TABLE IF NOT EXISTS fixed_window_rate_limits (
      key text NOT NULL,
      window bigint NOT NULL,
      count integer DEFAULT 0 NOT NULL,
      expires_at timestamp with time zone NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL,
      PRIMARY KEY (key, window)
    )
  `)
}

describeIfDb("Postgres shared stores", () => {
  beforeAll(async () => {
    await ensureSharedStoreTables()
  })

  afterEach(async () => {
    await cleanupTestDb(createTestDb())
    await ensureSharedStoreTables()
  })

  it("expires KV entries and lists by prefix", async () => {
    let clock = Date.now()
    const kv = createPostgresKvStore(createTestDb(), { now: () => clock, sweepIntervalMs: 0 })
    await kv.put("p:a", "1")
    await kv.put("p:b", "2", { expirationTtl: 1 })
    clock += 1_001

    expect(await kv.get("p:b")).toBeNull()
    await expect(kv.list?.({ prefix: "p:" })).resolves.toEqual({ keys: [{ name: "p:a" }] })
  })

  it("increments fixed-window counters atomically under concurrent calls", async () => {
    const store = createPostgresFixedWindowRateLimitStore(createTestDb(), { sweepIntervalMs: 0 })
    const results = await Promise.all(
      Array.from({ length: 5 }, () => store.limit("lim:test", { max: 3, windowSeconds: 60 })),
    )

    expect(results.filter((result) => result.allowed)).toHaveLength(3)
    expect(results.filter((result) => !result.allowed)).toHaveLength(2)
    expect(Math.min(...results.map((result) => result.remaining ?? 0))).toBe(0)
  })
})

describe("Postgres shared stores DB gate", () => {
  it("uses describeIfDb so the integration suite skips without TEST_DATABASE_URL", () => {
    expect(typeof describeIfDb).toBe("function")
  })
})
