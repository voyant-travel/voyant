import { type SQL, sql } from "drizzle-orm"

export interface SqlExecutor {
  execute(query: SQL): Promise<unknown>
}

export async function executeRows<T>(db: SqlExecutor, query: SQL): Promise<T[]> {
  const result = await db.execute(query)
  if (Array.isArray(result)) return result as T[]
  // node-postgres / neon-serverless drivers return `{ rows, rowCount, ... }`
  // instead of a bare array -- unwrap so this wrapper is driver-agnostic.
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows
  }
  return []
}

/**
 * Emit a Postgres `ARRAY[$1, $2, ...]::text[]` literal instead of the
 * naive `${jsArray}::text[]` form. Drizzle's `sql` template spreads
 * JS arrays into a row constructor (`($1, $2)`) which Postgres
 * refuses to cast to `text[]`. Empty input returns `ARRAY[]::text[]`.
 */
export function sqlTextArray(values: readonly string[]): SQL {
  if (values.length === 0) return sql`ARRAY[]::text[]`
  // agent-quality: raw-sql reviewed -- owner: availability; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
  return sql`ARRAY[${sql.join(
    // agent-quality: raw-sql reviewed -- owner: availability; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    values.map((value) => sql`${value}`),
    sql.raw(", "),
  )}]::text[]`
}
