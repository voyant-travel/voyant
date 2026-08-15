import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/**
 * The narrow read shape `resolveDocumentFxRate` uses against `exchange_rates`:
 * `select(...).from(...).where(...).orderBy(...).limit(1)`.
 *
 * Unit tests that only exercise the resolver leg still have to answer it,
 * because looking for an already-captured rate before reaching for the source
 * is the whole point of the ordering (voyant#4703).
 */
export function fakeRateStore(rows: readonly unknown[] = []): PostgresJsDatabase {
  const rowsFor = async () => [...rows]
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: rowsFor }),
          limit: rowsFor,
        }),
      }),
    }),
  } as unknown as PostgresJsDatabase
}
