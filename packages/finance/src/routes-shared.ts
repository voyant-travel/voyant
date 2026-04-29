import type { ModuleContainer } from "@voyantjs/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

export type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    container?: ModuleContainer
  }
}

export function notFound<T extends Env>(c: Context<T>, error: string) {
  return c.json({ error }, 404)
}
