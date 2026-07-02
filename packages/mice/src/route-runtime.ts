import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type ResolveMiceDelegatePersonById = (
  db: PostgresJsDatabase,
  personId: string,
) => Promise<boolean>

export interface MiceRouteRuntimeOptions {
  resolveDelegatePersonById?: ResolveMiceDelegatePersonById
}

export interface MiceRouteRuntime extends MiceRouteRuntimeOptions {}
