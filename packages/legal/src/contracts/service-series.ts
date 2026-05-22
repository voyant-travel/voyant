import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { contractNumberSeries } from "./schema.js"
import type {
  ContractNumberSeriesListQuery,
  CreateContractNumberSeriesInput,
  UpdateContractNumberSeriesInput,
} from "./service-shared.js"

type ContractScope = (typeof contractNumberSeries.scope.enumValues)[number]

export class ContractSeriesAmbiguousError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ContractSeriesAmbiguousError"
  }
}

export const contractSeriesService = {
  async listSeries(db: PostgresJsDatabase, query: ContractNumberSeriesListQuery = {}) {
    const conditions = []
    if (query.scope) conditions.push(eq(contractNumberSeries.scope, query.scope))
    if (query.active !== undefined) conditions.push(eq(contractNumberSeries.active, query.active))
    const where = conditions.length ? and(...conditions) : undefined

    return db
      .select()
      .from(contractNumberSeries)
      .where(where)
      .orderBy(desc(contractNumberSeries.updatedAt))
  },
  async getSeriesById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(contractNumberSeries)
      .where(eq(contractNumberSeries.id, id))
      .limit(1)
    return row ?? null
  },
  /**
   * Resolve the single active series for a (prefix, scope) pair. Throws
   * if the partial unique index has been bypassed and >1 active row
   * exists. Prefer this over `findSeriesByName` — `(prefix, scope)` is
   * the natural key for the generated number; `name` is just a label.
   */
  async findActiveByPrefixScope(db: PostgresJsDatabase, prefix: string, scope: ContractScope) {
    const rows = await db
      .select()
      .from(contractNumberSeries)
      .where(
        and(
          eq(contractNumberSeries.prefix, prefix),
          eq(contractNumberSeries.scope, scope),
          eq(contractNumberSeries.active, true),
        ),
      )
      .limit(2)
    if (rows.length > 1) {
      throw new ContractSeriesAmbiguousError(
        `Multiple active contract_number_series rows match prefix=${prefix}, scope=${scope}. The partial unique index is missing or has been bypassed.`,
      )
    }
    return rows[0] ?? null
  },
  /**
   * Resolve the sole active series for a scope. Used by one-click booking
   * contract generation, where guessing between multiple active numbering
   * series would issue the wrong legal number.
   */
  async findSingleActiveByScope(db: PostgresJsDatabase, scope: ContractScope) {
    const rows = await db
      .select()
      .from(contractNumberSeries)
      .where(and(eq(contractNumberSeries.scope, scope), eq(contractNumberSeries.active, true)))
      .orderBy(desc(contractNumberSeries.updatedAt))
      .limit(2)
    if (rows.length > 1) {
      throw new ContractSeriesAmbiguousError(
        `Multiple active contract_number_series rows match scope=${scope}. Archive duplicates or pass an explicit series.`,
      )
    }
    return rows[0] ?? null
  },
  /**
   * @deprecated Prefer `findActiveByPrefixScope`. `name` has no unique
   * constraint, so two active rows can share a name; this method now
   * throws on multi-match instead of picking the most-recently-updated.
   */
  async findSeriesByName(db: PostgresJsDatabase, name: string) {
    const rows = await db
      .select()
      .from(contractNumberSeries)
      .where(and(eq(contractNumberSeries.name, name), eq(contractNumberSeries.active, true)))
      .limit(2)
    if (rows.length > 1) {
      throw new ContractSeriesAmbiguousError(
        `Multiple active contract_number_series rows match name=${name}. Resolve by archiving duplicates (active=false) or migrate the caller to findActiveByPrefixScope.`,
      )
    }
    return rows[0] ?? null
  },
  async createSeries(db: PostgresJsDatabase, data: CreateContractNumberSeriesInput) {
    const [row] = await db.insert(contractNumberSeries).values(data).returning()
    return row ?? null
  },
  /**
   * Idempotent create-or-update against the `(prefix, scope) WHERE active`
   * partial unique index. Lets consumer seed scripts converge the row
   * without tracking ids.
   */
  async upsertByPrefixScope(db: PostgresJsDatabase, data: CreateContractNumberSeriesInput) {
    const [row] = await db
      .insert(contractNumberSeries)
      .values(data)
      .onConflictDoUpdate({
        target: [contractNumberSeries.prefix, contractNumberSeries.scope],
        targetWhere: sql`${contractNumberSeries.active} = true`,
        set: {
          name: data.name,
          separator: data.separator,
          padLength: data.padLength,
          resetStrategy: data.resetStrategy,
          updatedAt: new Date(),
        },
      })
      .returning()
    return row ?? null
  },
  async updateSeries(db: PostgresJsDatabase, id: string, data: UpdateContractNumberSeriesInput) {
    const [row] = await db
      .update(contractNumberSeries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contractNumberSeries.id, id))
      .returning()
    return row ?? null
  },
  async deleteSeries(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(contractNumberSeries)
      .where(eq(contractNumberSeries.id, id))
      .returning({ id: contractNumberSeries.id })
    return row ?? null
  },
}
