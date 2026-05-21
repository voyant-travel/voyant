export const VOYANT_DB_SUPPORTS_TRANSACTIONS = Symbol.for("voyant.db.supportsTransactions")
export const VOYANT_DB_DISPOSE = Symbol.for("voyant.db.dispose")

export type DbTransactionCapability = {
  [VOYANT_DB_SUPPORTS_TRANSACTIONS]?: boolean
}

export type DbDisposeCapability = {
  [VOYANT_DB_DISPOSE]?: () => Promise<void>
}

export function dbSupportsTransactions(db: unknown): boolean | undefined {
  if (!db || (typeof db !== "object" && typeof db !== "function")) {
    return undefined
  }

  const capability = (db as DbTransactionCapability)[VOYANT_DB_SUPPORTS_TRANSACTIONS]
  return typeof capability === "boolean" ? capability : undefined
}

export function dbClientDispose(db: unknown): (() => Promise<void>) | undefined {
  if (!db || (typeof db !== "object" && typeof db !== "function")) {
    return undefined
  }

  const dispose = (db as DbDisposeCapability)[VOYANT_DB_DISPOSE]
  return typeof dispose === "function" ? dispose : undefined
}
