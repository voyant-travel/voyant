import type { NeonHttpDatabase } from "drizzle-orm/neon-http"
import type { NeonDatabase as NeonWsDatabase } from "drizzle-orm/neon-serverless"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/**
 * A generic type for a Drizzle client instance.
 * It's compatible with instances created using either the `postgres-js`
 * or `neon-http` drivers, regardless of the specific schema.
 */
export type DrizzleClient =
  | PostgresJsDatabase<Record<string, unknown>>
  | NeonHttpDatabase<Record<string, unknown>>
  | NeonWsDatabase<Record<string, unknown>>
