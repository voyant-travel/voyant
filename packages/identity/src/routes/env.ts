import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type IdentityRouteEnv = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}
