import { describe, expect, test } from "vitest"
import {
  createDbClient,
  createServerlessDbClient,
  dbClientDispose,
  dbSupportsTransactions,
} from "../../src/index.js"

const TEST_DATABASE_URL = "postgres://user:password@example.com:5432/voyant"

describe("db transaction capability", () => {
  test("marks node adapter clients as transaction-capable", () => {
    const db = createDbClient(TEST_DATABASE_URL, { adapter: "node" })

    expect(dbSupportsTransactions(db)).toBe(true)
  })

  test("marks edge adapter clients as not transaction-capable", () => {
    const db = createDbClient(TEST_DATABASE_URL, { adapter: "edge" })

    expect(dbSupportsTransactions(db)).toBe(false)
  })

  test("marks serverless adapter clients as transaction-capable", async () => {
    const handle = createServerlessDbClient(TEST_DATABASE_URL)
    const db = createDbClient(TEST_DATABASE_URL, { adapter: "serverless" })
    const dispose = dbClientDispose(db)

    try {
      expect(dbSupportsTransactions(handle.db)).toBe(true)
      expect(dbSupportsTransactions(db)).toBe(true)
      expect(dispose).toBeTypeOf("function")
    } finally {
      await handle.dispose()
      await dispose?.()
    }
  })

  test("rejects read replicas for serverless adapter clients", () => {
    expect(() =>
      createDbClient(TEST_DATABASE_URL, {
        adapter: "serverless",
        replicas: ["postgres://replica:password@example.com:5432/voyant"],
      }),
    ).toThrow(/does not support read replicas/)
  })
})
