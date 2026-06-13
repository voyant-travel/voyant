import { type SQL, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export async function executeBoundaryRows<T extends object>(
  db: PostgresJsDatabase,
  query: SQL,
): Promise<T[]> {
  // biome-ignore lint/suspicious/noExplicitAny: #1141 keeps cross-package SQL boundary reads driver-agnostic.
  const result = await (db as any).execute(query)
  return (Array.isArray(result) ? result : (result?.rows ?? [])) as T[]
}

export function sqlList(values: readonly string[]): SQL {
  // agent-quality: raw-sql reviewed -- owner: finance; callers pass only parameter-bound scalar ids into the joined SQL fragment.
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )
}

export function normalizeDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)
}
