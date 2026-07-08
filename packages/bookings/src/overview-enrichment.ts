import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { BookingOverviewItemEnricher } from "./route-runtime.js"

/**
 * Minimal shape an overview item must satisfy to be enriched. The public
 * overview items carry many more fields; enrichers only read these.
 */
export interface EnrichableOverviewItem {
  id: string
  itemType: string
  productId: string | null
  optionId: string | null
}

/**
 * Attach vertical `details` blocks to public-overview items using the
 * deployment-registered enrichers (issue #2969). Items are grouped by
 * `itemType`; each registered enricher is invoked ONCE with its group and
 * returns a `Map<bookingItemId, details>` that is merged back onto the
 * matching items.
 *
 * Enrichment is best-effort: a throwing or absent enricher leaves the
 * affected items without a `details` field rather than failing the whole
 * overview — this rides inside an already guest-authorized snapshot and a
 * "manage my booking" surface must not 500 because a detail join broke.
 */
export async function applyOverviewEnrichers<T extends EnrichableOverviewItem>(
  db: PostgresJsDatabase,
  items: T[],
  enrichers?: Partial<Record<string, BookingOverviewItemEnricher>>,
): Promise<Array<T & { details?: unknown }>> {
  if (!enrichers || items.length === 0) {
    return items
  }

  const itemsByType = new Map<string, T[]>()
  for (const item of items) {
    const group = itemsByType.get(item.itemType)
    if (group) {
      group.push(item)
    } else {
      itemsByType.set(item.itemType, [item])
    }
  }

  const detailsByItemId = new Map<string, unknown>()
  await Promise.all(
    [...itemsByType.entries()].map(async ([itemType, group]) => {
      const enrich = enrichers[itemType]
      if (!enrich) return
      try {
        const result = await enrich(
          db,
          group.map((item) => ({
            id: item.id,
            itemType: item.itemType,
            productId: item.productId,
            optionId: item.optionId,
          })),
        )
        for (const [bookingItemId, details] of result) {
          detailsByItemId.set(bookingItemId, details)
        }
      } catch (error) {
        // Best-effort: skip this vertical's details, keep the overview.
        console.error(`[bookings] overview enricher for "${itemType}" failed`, error)
      }
    }),
  )

  if (detailsByItemId.size === 0) {
    return items
  }

  return items.map((item) => {
    const details = detailsByItemId.get(item.id)
    return details === undefined ? item : { ...item, details }
  })
}
