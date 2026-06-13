/**
 * Promotions domain events.
 *
 * Per docs/architecture/promotions-architecture.md §9.1.
 *
 * Emitted (after the service mutation commits) by every CRUD path that
 * changes a field affecting projection or evaluation. Pure metadata-only
 * edits (`description`, `metadata`) skip emission to avoid pointless
 * reindex churn.
 *
 * The catalog bridge subscribes and dispatches per `affected.kind`:
 *   - `products` → reindex the listed product IDs only.
 *   - `all`      → reindex every owned product (used when the resolved
 *                   product set would be too large to enumerate, or for
 *                   `global`-scope offers).
 *
 * No `slices` variant: `IndexerService` (packages/catalog/src/services/
 * indexer-service.ts:75) has `reindexEntity` (one entity, all slices) and
 * `reindexEntityForSlice` (one entity, one slice) but no "reindex every
 * product in this slice" helper. Slice-shaped scopes (`markets`,
 * `audiences`) are resolved to product IDs at emission time, falling back
 * to `all` when the resolved set would be unbounded.
 */

/** Stable string identifier for the event. */
export const PROMOTION_CHANGED_EVENT = "promotion.changed" as const

export type PromotionChangedSource = "created" | "updated" | "deleted" | "expired"

export type PromotionChangedAffected = { kind: "products"; productIds: string[] } | { kind: "all" }

export interface PromotionChangedEvent {
  offerId: string
  source: PromotionChangedSource
  affected: PromotionChangedAffected
}
