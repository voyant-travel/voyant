import { gt, type SQLWrapper } from "drizzle-orm"
import type { AnyPgTable } from "drizzle-orm/pg-core"

import type { DrizzleClient } from "../types.js"

export type KeysetPage<T> = { rows: T[]; nextCursor?: string }

// Note: Made this more generic by accepting a 'getCursor' function
type KeysetQuery<TRow> = PromiseLike<TRow[]> & {
  limit(limit: number): KeysetQuery<TRow>
  orderBy(orderExpr: SQLWrapper): KeysetQuery<TRow>
  where(condition: SQLWrapper): KeysetQuery<TRow>
}

export async function keysetPaginate<TRow extends Record<string, unknown>>(
  db: DrizzleClient,
  queryBuilder: (db: DrizzleClient) => KeysetQuery<TRow>,
  orderExpr: SQLWrapper,
  getCursor: (row: TRow) => string | Date,
  cursorValue?: string,
  limit = 20,
): Promise<KeysetPage<TRow>> {
  let qb = queryBuilder(db)
    .orderBy(orderExpr)
    .limit(limit + 1)

  if (cursorValue) {
    // A simple date check, can be made more robust
    const cursorAsDate = new Date(cursorValue)
    if (!Number.isNaN(cursorAsDate.getTime())) {
      qb = qb.where(gt(orderExpr, cursorAsDate))
    }
  }

  const rows = (await qb) as TRow[]
  const hasNext = rows.length > limit
  if (hasNext) rows.pop()

  const lastRow = rows[rows.length - 1]
  const nextCursor = hasNext && lastRow ? getCursor(lastRow)?.toString() : undefined
  return { rows, nextCursor }
}

export async function batchInsert<TTable extends AnyPgTable>(
  db: DrizzleClient,
  table: TTable,
  values: Array<TTable["$inferInsert"]>,
  chunkSize = 1000,
) {
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize)
    await db.insert(table).values(chunk)
  }
}

type TransactionFor<TDb extends DrizzleClient> = Parameters<TDb["transaction"]>[0] extends (
  tx: infer TTransaction,
  ...args: never[]
) => Promise<unknown>
  ? TTransaction
  : never

export async function withTransaction<T, TDb extends DrizzleClient>(
  db: TDb,
  run: (tx: TransactionFor<TDb>) => Promise<T>,
) {
  return db.transaction(async (tx) => run(tx as TransactionFor<TDb>))
}
