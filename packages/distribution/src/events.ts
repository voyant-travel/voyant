/**
 * Distribution domain events.
 *
 * Emitted (after the write commits) by every service path that mutates a
 * product↔channel mapping — create, update, delete, and the activate /
 * deactivate cases of update. Batch/import paths route through the same
 * single-item service methods, so they emit too.
 *
 * `product.publication.changed` is the durable signal that a product's
 * storefront publication may have shifted: adding an active mapping to an
 * active direct-sales channel makes the product pass the storefront
 * listability predicate, and removing/deactivating one should tombstone the
 * catalog slice. Catalog integrations subscribe and reindex the affected
 * product's customer-facing slices.
 *
 * Subscribers MUST treat the payload as a trigger, not the source of truth —
 * "publication" (is the product listable via ANY active mapping to an active
 * channel) can't be read off a single mapping row, so re-derive listability
 * from the current DB state before acting. `previousActive` / `nextActive`
 * describe only THIS mapping.
 */

import type { EventBus } from "@voyant-travel/core"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { channels } from "./schema.js"

/** Stable string identifier for the event. */
export const PRODUCT_PUBLICATION_CHANGED_EVENT = "product.publication.changed" as const

/**
 * Which write produced the event. `activated` / `deactivated` are the update
 * cases where the mapping's `active` flag flipped; a plain field edit is
 * `updated`.
 */
export type ProductPublicationOperation =
  | "created"
  | "updated"
  | "deleted"
  | "activated"
  | "deactivated"

export interface ProductPublicationChangedEvent {
  productId: string
  channelId: string
  /** The mapping row id. `null` only if the row couldn't be resolved. */
  mappingId: string | null
  /** Mapping active state BEFORE the change. `null` when it did not exist (created). */
  previousActive: boolean | null
  /** Mapping active state AFTER the change. `null` when the mapping was removed (deleted). */
  nextActive: boolean | null
  operation: ProductPublicationOperation
  /** Channel kind at emit time (diagnostic; e.g. "direct", "ota"). `null` if unresolved. */
  channelKind: string | null
  /** Channel status at emit time (diagnostic; e.g. "active"). `null` if unresolved. */
  channelStatus: string | null
}

/**
 * Emit `product.publication.changed`. Fire-and-forget and never throws — a
 * failed lookup or emit must not fail the mapping write that triggered it
 * (per the EventBus contract). No-ops when no bus is wired.
 */
export async function emitProductPublicationChanged(
  eventBus: EventBus | undefined,
  db: PostgresJsDatabase,
  input: {
    productId: string
    channelId: string
    mappingId: string | null
    previousActive: boolean | null
    nextActive: boolean | null
    operation: ProductPublicationOperation
  },
): Promise<void> {
  if (!eventBus) return
  try {
    let channelKind: string | null = null
    let channelStatus: string | null = null
    const [channel] = await db
      .select({ kind: channels.kind, status: channels.status })
      .from(channels)
      .where(eq(channels.id, input.channelId))
      .limit(1)
    if (channel) {
      channelKind = channel.kind
      channelStatus = channel.status
    }
    await eventBus.emit<ProductPublicationChangedEvent>(
      PRODUCT_PUBLICATION_CHANGED_EVENT,
      { ...input, channelKind, channelStatus },
      { category: "domain", source: "service" },
    )
  } catch (error) {
    // Never let event emission break the mutation. Log and swallow.
    console.error(`[distribution] failed to emit ${PRODUCT_PUBLICATION_CHANGED_EVENT}`, error)
  }
}

/**
 * Classify an update by comparing the mapping's `active` flag before and
 * after: a flip is `activated` / `deactivated`, anything else is `updated`.
 */
export function classifyMappingUpdate(
  previousActive: boolean,
  nextActive: boolean,
): ProductPublicationOperation {
  if (previousActive && !nextActive) return "deactivated"
  if (!previousActive && nextActive) return "activated"
  return "updated"
}
