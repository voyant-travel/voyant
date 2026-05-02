import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"

export type DemoFlightsDb = PostgresJsDatabase<Record<string, never>>

export function createDb(databaseUrl: string): {
  db: DemoFlightsDb
  close: () => Promise<void>
} {
  const sql = postgres(databaseUrl, { max: 5 })
  const db = drizzle(sql)
  return {
    db,
    close: async () => {
      await sql.end()
    },
  }
}
