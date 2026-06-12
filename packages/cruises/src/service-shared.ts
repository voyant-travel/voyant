import type { EventBus } from "@voyantjs/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export const setUpdated = { updatedAt: new Date() }

export function paginate(query: { limit: number; offset: number }) {
  return { limit: query.limit, offset: query.offset }
}

export interface CruiseMutationRuntime {
  eventBus?: EventBus
}

/**
 * Re-project a cruise into cruise_search_index after a mutation. Errors are
 * swallowed and logged; the search index is best-effort and never blocks the
 * underlying mutation.
 */
export async function reprojectIfPossible(
  db: PostgresJsDatabase,
  cruiseId: string | null,
): Promise<void> {
  if (!cruiseId) return
  try {
    const { cruisesSearchService } = await import("./service-search.js")
    await cruisesSearchService.projectLocalCruise(db, cruiseId)
  } catch (err) {
    // Don't crash the caller. Operators can run the search-index rebuild route to repair drift.
    // eslint-disable-next-line no-console -- owner: cruises; existing suppression is intentional pending typed cleanup.
    console.warn(`[cruises] search-index projection failed for ${cruiseId}:`, err)
  }
}
