import { and, eq, getTableColumns, isNull, type SQL, sql } from "drizzle-orm"
import type { AnyPgTable, PgColumn } from "drizzle-orm/pg-core"
import type { z } from "zod"

import type { InsertModel, SelectModel } from "./helpers.js"
import type { DrizzleClient } from "./types.js"

/**
 * Options accepted by {@link createCrudService}.
 */
export interface CrudServiceOptions<
  TInsertSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TUpdateSchema extends z.ZodTypeAny = z.ZodTypeAny,
> {
  /** Optional Zod schema run against inputs passed to `create`. */
  insertSchema?: TInsertSchema
  /** Optional Zod schema run against inputs passed to `update`. */
  updateSchema?: TUpdateSchema
}

/**
 * Options for list-style queries.
 */
export interface ListOptions {
  /** WHERE clause, typically composed with `and()`. */
  where?: SQL
  /** Max number of rows to return. */
  limit?: number
  /** Offset for pagination. */
  offset?: number
  /**
   * ORDER BY clauses. Accept a single clause or array. Consumers pass
   * `asc(table.column)` / `desc(table.column)` builders.
   */
  orderBy?: SQL | SQL[]
  /**
   * When the table has a `deletedAt` column, soft-deleted rows are filtered
   * out by default. Pass `true` to include them — useful for admin recycle
   * bins, audit reports, or background reconciliation jobs.
   */
  includeDeleted?: boolean
}

/**
 * Options for retrieve-style lookups by id.
 */
export interface RetrieveOptions {
  /** Include soft-deleted rows. Default: false. */
  includeDeleted?: boolean
}

// biome-ignore lint/suspicious/noExplicitAny: Drizzle generic inference breaks on TTable extends AnyPgTable — casts are isolated to the query-builder boundary
type AnyDb = any

/**
 * A generic CRUD service bound to a single Drizzle table.
 *
 * Generated methods:
 * - `list(db, opts)` — returns rows
 * - `count(db, where?)` — returns integer count
 * - `listAndCount(db, opts)` — returns `{ data, total }`
 * - `retrieve(db, id)` — returns row or `null`
 * - `create(db, data)` — inserts and returns the row
 * - `update(db, id, data)` — updates and returns the row (or `null` if missing);
 *   automatically sets `updatedAt: new Date()` when the table has that column
 * - `delete(db, id)` — hard-deletes and returns `{ id }` or `null`
 * - `softDelete(db, id)` — sets `deletedAt: new Date()` when the column exists
 * - `restore(db, id)` — clears `deletedAt` when the column exists
 *
 * Consumers compose custom methods by spreading the result:
 * ```ts
 * const crud = createCrudService(peopleTable)
 * export const peopleService = {
 *   ...crud,
 *   async findByEmail(db: DrizzleClient, email: string) { ... },
 * }
 * ```
 */
export function createCrudService<
  TTable extends AnyPgTable,
  TInsertSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TUpdateSchema extends z.ZodTypeAny = z.ZodTypeAny,
>(table: TTable, options: CrudServiceOptions<TInsertSchema, TUpdateSchema> = {}) {
  const columns = getTableColumns(table) as Record<string, PgColumn>
  if (!columns.id) {
    throw new Error("createCrudService: table must declare an 'id' column")
  }
  const idColumn: PgColumn = columns.id
  const updatedAtColumn: PgColumn | undefined = columns.updatedAt
  const deletedAtColumn: PgColumn | undefined = columns.deletedAt

  type Row = SelectModel<TTable>
  type InsertInput = InsertModel<TTable>

  // Drizzle's query builder types lose fidelity under generic TTable — cast
  // db to AnyDb only at the Drizzle call site; return types stay strict.
  const asDb = (db: DrizzleClient): AnyDb => db

  function activeFilter(): SQL | undefined {
    return deletedAtColumn ? isNull(deletedAtColumn) : undefined
  }

  function composeWhere(opts: { where?: SQL; includeDeleted?: boolean }): SQL | undefined {
    if (opts.includeDeleted) return opts.where
    const active = activeFilter()
    if (!active) return opts.where
    if (!opts.where) return active
    return and(opts.where, active)
  }

  async function list(db: DrizzleClient, opts: ListOptions = {}): Promise<Row[]> {
    let query = asDb(db).select().from(table)
    const where = composeWhere(opts)
    if (where) query = query.where(where)
    if (opts.orderBy) {
      const orders = Array.isArray(opts.orderBy) ? opts.orderBy : [opts.orderBy]
      query = query.orderBy(...orders)
    }
    if (typeof opts.limit === "number") query = query.limit(opts.limit)
    if (typeof opts.offset === "number") query = query.offset(opts.offset)
    const rows = (await query) as Row[]
    return rows
  }

  async function count(
    db: DrizzleClient,
    where?: SQL,
    opts: { includeDeleted?: boolean } = {},
  ): Promise<number> {
    const base = asDb(db).select({ count: sql<number>`count(*)::int` }).from(table)
    const composed = composeWhere({ where, includeDeleted: opts.includeDeleted })
    const rows = (composed ? await base.where(composed) : await base) as Array<{ count: number }>
    return rows[0]?.count ?? 0
  }

  /**
   * One roundtrip instead of two: the total rides along as a
   * `count(*) OVER ()` window column and is stripped from the returned
   * rows. The separate-count approach paid the full filtered scan in
   * `count()` anyway — the window adds no scan cost, and on per-query
   * transports (neon-http: one fetch per query) it halves the
   * roundtrips/subrequests per list endpoint. The only case needing a
   * fallback query is an offset pointing past the last row, where the
   * page is empty and the window total is unobservable.
   */
  async function listAndCount(
    db: DrizzleClient,
    opts: ListOptions = {},
  ): Promise<{ data: Row[]; total: number }> {
    let query = asDb(db)
      .select({
        ...getTableColumns(table),
        __voyantWindowTotal: sql<number>`count(*) over()::int`,
      })
      .from(table)
    const where = composeWhere(opts)
    if (where) query = query.where(where)
    if (opts.orderBy) {
      const orders = Array.isArray(opts.orderBy) ? opts.orderBy : [opts.orderBy]
      query = query.orderBy(...orders)
    }
    if (typeof opts.limit === "number") query = query.limit(opts.limit)
    if (typeof opts.offset === "number") query = query.offset(opts.offset)
    const rows = (await query) as Array<Row & { __voyantWindowTotal: number }>

    const first = rows[0]
    if (!first) {
      // Empty page. Without an offset the filtered set is genuinely
      // empty; with one, the offset may simply point past the end.
      const total = opts.offset
        ? await count(db, opts.where, { includeDeleted: opts.includeDeleted })
        : 0
      return { data: [], total }
    }

    const total = first.__voyantWindowTotal
    const data = rows.map(({ __voyantWindowTotal: _total, ...rest }) => rest as unknown as Row)
    return { data, total }
  }

  async function retrieve(
    db: DrizzleClient,
    id: string,
    opts: RetrieveOptions = {},
  ): Promise<Row | null> {
    const where = composeWhere({ where: eq(idColumn, id), includeDeleted: opts.includeDeleted })
    const rows = (await asDb(db).select().from(table).where(where).limit(1)) as Row[]
    return rows[0] ?? null
  }

  async function create(db: DrizzleClient, data: InsertInput): Promise<Row> {
    const validated = options.insertSchema
      ? (options.insertSchema.parse(data) as InsertInput)
      : data
    const rows = (await asDb(db).insert(table).values(validated).returning()) as Row[]
    const row = rows[0]
    if (!row) {
      throw new Error("createCrudService: insert returned no rows")
    }
    return row
  }

  async function update(
    db: DrizzleClient,
    id: string,
    data: Partial<InsertInput>,
  ): Promise<Row | null> {
    const validated = options.updateSchema
      ? (options.updateSchema.parse(data) as Partial<InsertInput>)
      : data
    const patch: Record<string, unknown> = { ...(validated as object) }
    if (updatedAtColumn) {
      patch.updatedAt = new Date()
    }
    const rows = (await asDb(db)
      .update(table)
      .set(patch)
      .where(eq(idColumn, id))
      .returning()) as Row[]
    return rows[0] ?? null
  }

  async function remove(db: DrizzleClient, id: string): Promise<{ id: string } | null> {
    const rows = (await asDb(db)
      .delete(table)
      .where(eq(idColumn, id))
      .returning({ id: idColumn })) as Array<{ id: string }>
    return rows[0] ?? null
  }

  async function softDelete(db: DrizzleClient, id: string): Promise<Row | null> {
    if (!deletedAtColumn) {
      throw new Error("createCrudService: softDelete requires a 'deletedAt' column")
    }
    const rows = (await asDb(db)
      .update(table)
      .set({ deletedAt: new Date() })
      .where(eq(idColumn, id))
      .returning()) as Row[]
    return rows[0] ?? null
  }

  async function restore(db: DrizzleClient, id: string): Promise<Row | null> {
    if (!deletedAtColumn) {
      throw new Error("createCrudService: restore requires a 'deletedAt' column")
    }
    const rows = (await asDb(db)
      .update(table)
      .set({ deletedAt: null })
      .where(eq(idColumn, id))
      .returning()) as Row[]
    return rows[0] ?? null
  }

  return {
    table,
    list,
    count,
    listAndCount,
    retrieve,
    create,
    update,
    delete: remove,
    softDelete,
    restore,
    hasSoftDelete: Boolean(deletedAtColumn),
  }
}
