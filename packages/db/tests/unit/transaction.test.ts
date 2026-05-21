import { describe, expect, test, vi } from "vitest"
import { withOptionalTransaction } from "../../src/transaction.js"
import { VOYANT_DB_SUPPORTS_TRANSACTIONS } from "../../src/transaction-capability.js"

describe("withOptionalTransaction", () => {
  test("skips transaction when capability tag says transactions are unsupported", async () => {
    const db = {
      [VOYANT_DB_SUPPORTS_TRANSACTIONS]: false,
      transaction: vi.fn(() => {
        throw new Error("transaction should not be called")
      }),
    }

    const result = await withOptionalTransaction(db, async (tx) => {
      expect(tx).toBe(db)
      return "ok"
    })

    expect(result).toBe("ok")
    expect(db.transaction).not.toHaveBeenCalled()
  })

  test("invokes transaction() when capability tag says transactions are supported", async () => {
    const fakeTx = { kind: "tx" } as Record<string, unknown>
    const db = {
      [VOYANT_DB_SUPPORTS_TRANSACTIONS]: true,
      transaction: vi.fn(async <T>(callback: (tx: typeof fakeTx) => Promise<T>) =>
        callback(fakeTx),
      ),
    }

    const result = await withOptionalTransaction(db, async (tx) => {
      expect(tx).toBe(fakeTx)
      return "wrapped"
    })

    expect(result).toBe("wrapped")
    expect(db.transaction).toHaveBeenCalledOnce()
  })

  test("invokes callback directly when the db has no transaction method", async () => {
    const db = {} as Record<string, unknown>

    const result = await withOptionalTransaction(db, async (tx) => {
      expect(tx).toBe(db)
      return "no-tx-method"
    })

    expect(result).toBe("no-tx-method")
  })

  test("falls back when an untagged HTTP driver throws before the callback starts", async () => {
    const db = {
      transaction: vi.fn(() => {
        throw new Error("No transactions support in neon-http driver")
      }),
    }

    const result = await withOptionalTransaction(db, async (tx) => {
      expect(tx).toBe(db)
      return "fallback"
    })

    expect(result).toBe("fallback")
    expect(db.transaction).toHaveBeenCalledOnce()
  })

  test("does not retry when an error is raised after the callback starts", async () => {
    const fakeTx = { kind: "tx" } as Record<string, unknown>
    const callbackTargets: unknown[] = []
    const db = {
      [VOYANT_DB_SUPPORTS_TRANSACTIONS]: true,
      async transaction<T>(callback: (tx: typeof fakeTx) => Promise<T>) {
        return callback(fakeTx)
      },
    }

    await expect(
      withOptionalTransaction(db, async (tx) => {
        callbackTargets.push(tx)
        throw new Error("No transactions support in a nested write")
      }),
    ).rejects.toThrow(/nested write/)

    expect(callbackTargets).toEqual([fakeTx])
  })

  test("propagates non-transaction errors without retrying", async () => {
    const db = {
      [VOYANT_DB_SUPPORTS_TRANSACTIONS]: true,
      transaction: vi.fn(() => {
        throw new Error("unrelated boom")
      }),
    }

    await expect(withOptionalTransaction(db, async () => "should-not-reach")).rejects.toThrow(
      /unrelated boom/,
    )

    expect(db.transaction).toHaveBeenCalledOnce()
  })

  test("reuses an already-active transaction handle for nested calls", async () => {
    const fakeTx = { kind: "tx" } as Record<string, unknown>
    const innerOuterCalls: number[] = []
    const db = {
      [VOYANT_DB_SUPPORTS_TRANSACTIONS]: true,
      transaction: vi.fn(async <T>(callback: (tx: typeof fakeTx) => Promise<T>) =>
        callback(fakeTx),
      ),
    }

    const result = await withOptionalTransaction(db, async (outerTx) => {
      innerOuterCalls.push(1)
      const inner = await withOptionalTransaction(outerTx, async (innerTx) => {
        innerOuterCalls.push(2)
        expect(innerTx).toBe(outerTx)
        return "inner"
      })
      return inner
    })

    expect(result).toBe("inner")
    expect(innerOuterCalls).toEqual([1, 2])
    expect(db.transaction).toHaveBeenCalledOnce()
  })

  test("releases nested-tx tracking after the outer transaction returns", async () => {
    const fakeTx = { kind: "tx" } as Record<string, unknown>
    const db = {
      [VOYANT_DB_SUPPORTS_TRANSACTIONS]: true,
      transaction: vi.fn(async <T>(callback: (tx: typeof fakeTx) => Promise<T>) =>
        callback(fakeTx),
      ),
    }

    await withOptionalTransaction(db, async () => "first")
    await withOptionalTransaction(db, async () => "second")

    expect(db.transaction).toHaveBeenCalledTimes(2)
  })
})
