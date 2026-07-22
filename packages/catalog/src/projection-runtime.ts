import { z } from "zod"

import type { EntityOverlayChangedPayload } from "./events/taxonomy.js"

export {
  type CatalogProjectionRuntimeProvider,
  catalogProjectionRuntimePort,
} from "./subscriber-runtime-ports.js"

/** Service-container key used by package-owned Catalog projection subscribers. */
export const CATALOG_PROJECTION_RUNTIME_CONTAINER_KEY = "runtime.catalog.projection"

/** Identifies one Catalog entity whose search projection must be refreshed or removed. */
export const catalogProjectionTargetSchema = z
  .object({
    entityModule: z.string().trim().min(1),
    entityId: z.string().trim().min(1),
    locale: z.string().trim().min(1).optional(),
    audience: z.string().trim().min(1).optional(),
    market: z.string().trim().min(1).optional(),
  })
  .strict()

export type CatalogProjectionTarget = z.infer<typeof catalogProjectionTargetSchema>

/** Parse an event-derived projection target before invoking deployment runtime code. */
export function parseCatalogProjectionTarget(input: unknown): CatalogProjectionTarget {
  return catalogProjectionTargetSchema.parse(input)
}

/**
 * Deployment-owned indexing boundary consumed by Catalog's projection subscribers.
 *
 * The deployment supplies database lifetime, configured slices, field-policy
 * registries, document builders, embedding providers, and the index adapter.
 */
export interface CatalogProjectionRuntime {
  reindexEntity(target: CatalogProjectionTarget): Promise<void>
  reindexReferencedSubject?(event: EntityOverlayChangedPayload): Promise<void>
  deleteEntity(target: CatalogProjectionTarget): Promise<void>
}

export type EnsureCatalogCollections = (ensureCollections: () => Promise<void>) => Promise<void>

/**
 * Serialize engine schema setup across event bursts without poisoning later
 * attempts when one setup call fails.
 */
export function createEnsureCatalogCollectionsSerializer(): EnsureCatalogCollections {
  let tail: Promise<void> = Promise.resolve()

  return async (ensureCollections) => {
    const run = tail.then(ensureCollections)
    tail = run.catch(() => undefined)
    await run
  }
}
