import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type OctoRouteEnv = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}
