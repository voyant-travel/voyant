import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type ResolveQuoteParticipantPersonById = (
  db: PostgresJsDatabase,
  personId: string,
) => Promise<boolean>

export interface QuotesRouteRuntimeOptions {
  resolveParticipantPersonById?: ResolveQuoteParticipantPersonById
}

export interface QuotesRouteRuntime extends QuotesRouteRuntimeOptions {}
