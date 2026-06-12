import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type DistributionRouteEnv = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}
