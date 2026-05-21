import { dbSupportsTransactions } from "./transaction-capability.js"

const activeTransactionDbs = new WeakSet<object>()

function isUnsupportedTransactionError(error: unknown): boolean {
  return error instanceof Error && /No transactions support/i.test(error.message)
}

type TransactionalLike<TDb, T> = {
  transaction?: (callback: (tx: TDb) => Promise<T>) => Promise<T>
}

/**
 * Run `callback` inside a database transaction when the driver supports one,
 * or invoke it directly against the same `db` handle when it doesn't.
 *
 * Designed for Voyant services that share code paths between drivers with
 * different transaction semantics:
 *
 * - `postgres-js` (node) and `neon-serverless` (WebSocket): real transactions.
 *   The driver's `transaction(...)` method is used.
 * - `neon-http` (edge): the HTTP driver tagged with
 *   `VOYANT_DB_SUPPORTS_TRANSACTIONS = false` by `createDbClient`. The
 *   callback runs directly against `db`. Writes execute as independent
 *   statements — atomicity is lost on this driver. Callers that need true
 *   atomicity must select a transaction-capable adapter at startup.
 *
 * Nested calls are detected via a `WeakSet`: when invoked with a `tx` handle
 * that the helper already opened, the callback runs in-place against that
 * same handle (no second `BEGIN`).
 *
 * As a defense-in-depth, if a driver's `transaction()` throws with
 * "No transactions support …" *before* the callback executes (i.e. the
 * capability tag is missing on an HTTP-like driver), the helper retries by
 * invoking the callback directly. Errors raised *after* the callback starts
 * are not retried — they propagate.
 */
export async function withOptionalTransaction<TDb, T>(
  db: TDb,
  callback: (tx: TDb) => Promise<T>,
): Promise<T> {
  if (db && typeof db === "object" && activeTransactionDbs.has(db as object)) {
    return callback(db)
  }

  if (dbSupportsTransactions(db) === false) {
    return callback(db)
  }

  const maybeTransactional = db as TransactionalLike<TDb, T>
  if (typeof maybeTransactional.transaction !== "function") {
    return callback(db)
  }

  let callbackStarted = false
  try {
    return await maybeTransactional.transaction(async (tx) => {
      callbackStarted = true
      const txKey = tx as unknown
      const trackable = txKey && typeof txKey === "object"
      if (trackable) {
        activeTransactionDbs.add(txKey as object)
      }
      try {
        return await callback(tx)
      } finally {
        if (trackable) {
          activeTransactionDbs.delete(txKey as object)
        }
      }
    })
  } catch (error) {
    if (!callbackStarted && isUnsupportedTransactionError(error)) {
      return callback(db)
    }
    throw error
  }
}

/** @internal — exposed for tests so they can assert WeakSet behavior */
export const __test__ = {
  activeTransactionDbs,
}
