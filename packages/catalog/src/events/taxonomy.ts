/**
 * Catalog event taxonomy — names, payload shapes, and visibility-filtered
 * payload builders.
 *
 * Catalog events ride Voyant's existing `@voyant-travel/core/events` envelope
 * (`name`, `data`, `metadata`, `emittedAt`) and are dispatched via the
 * existing webhook delivery pipeline (`infraWebhookSubscriptionsTable` +
 * the delivery worker). The catalog plane defines only the taxonomy and
 * payload-visibility rules; subscription storage, signing, retry, and
 * delivery are reused, not reinvented.
 *
 * See `docs/architecture/catalog-architecture.md` §5.8 for the full design.
 */

import type { EventBus, EventCategory, EventMetadata } from "@voyant-travel/core/events"

import type { DriftSeverity, FieldPolicyRegistry, Visibility } from "../contract.js"

// ─────────────────────────────────────────────────────────────────────────────
// Event names
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catalog event names. Stable strings — exposed as a const enum-like
 * lookup so consumers can subscribe by reference rather than typing
 * the names by hand.
 */
export const CATALOG_EVENTS = {
  ENTITY_CREATED: "catalog.entity.created",
  ENTITY_UPDATED: "catalog.entity.updated",
  ENTITY_ARCHIVED: "catalog.entity.archived",
  ENTITY_DELETED: "catalog.entity.deleted",
  ENTITY_PRICE_CHANGED: "catalog.entity.price.changed",
  ENTITY_AVAILABILITY_CHANGED: "catalog.entity.availability.changed",
  ENTITY_OVERLAY_CHANGED: "catalog.entity.overlay.changed",
  ENTITY_DRIFT_DETECTED: "catalog.entity.drift.detected",
  ENTITY_REFERENCE_MISSING: "catalog.entity.reference.missing",
  BOOKING_COMMITTED: "catalog.booking.committed",
  BOOKING_CANCELLED: "catalog.booking.cancelled",
  SOURCE_DISCONNECTED: "catalog.source.disconnected",
  SOURCE_RECONNECTED: "catalog.source.reconnected",
} as const

export type CatalogEventName = (typeof CATALOG_EVENTS)[keyof typeof CATALOG_EVENTS]

/**
 * Default category for each catalog event. `internal` events are not routed
 * to external (non-staff) webhook subscribers by default; external
 * subscribers may opt in only with `staff` audience scope.
 */
export const CATALOG_EVENT_CATEGORIES: Record<CatalogEventName, EventCategory> = {
  [CATALOG_EVENTS.ENTITY_CREATED]: "domain",
  [CATALOG_EVENTS.ENTITY_UPDATED]: "domain",
  [CATALOG_EVENTS.ENTITY_ARCHIVED]: "domain",
  [CATALOG_EVENTS.ENTITY_DELETED]: "domain",
  [CATALOG_EVENTS.ENTITY_PRICE_CHANGED]: "domain",
  [CATALOG_EVENTS.ENTITY_AVAILABILITY_CHANGED]: "domain",
  [CATALOG_EVENTS.ENTITY_OVERLAY_CHANGED]: "internal",
  [CATALOG_EVENTS.ENTITY_DRIFT_DETECTED]: "internal",
  [CATALOG_EVENTS.ENTITY_REFERENCE_MISSING]: "domain",
  [CATALOG_EVENTS.BOOKING_COMMITTED]: "domain",
  [CATALOG_EVENTS.BOOKING_CANCELLED]: "domain",
  [CATALOG_EVENTS.SOURCE_DISCONNECTED]: "domain",
  [CATALOG_EVENTS.SOURCE_RECONNECTED]: "domain",
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload shapes
// ─────────────────────────────────────────────────────────────────────────────

/** Common identity fields carried by every entity-scoped catalog event. */
export interface EntityScope {
  entity_module: string
  entity_id: string
}

/** Provenance fields denormalized into payloads so receivers can correlate. */
export interface ProvenanceFields {
  source_kind: string
  source_ref?: string
  source_connection_id?: string
}

export interface EntityCreatedPayload extends EntityScope, ProvenanceFields {
  occurred_at: string
}

export interface EntityUpdatedPayload extends EntityScope, ProvenanceFields {
  /** Field paths that changed. */
  changed_fields: string[]
  /** Field-keyed before/after — visibility-filtered before emit. */
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  occurred_at: string
}

export interface EntityArchivedPayload extends EntityScope, ProvenanceFields {
  reason?: string
  occurred_at: string
}

export interface EntityPriceChangedPayload extends EntityScope, ProvenanceFields {
  /** The volatile-indexed price field path that changed (e.g. "from_price"). */
  field_path: string
  before?: number
  after?: number
  currency?: string
  occurred_at: string
}

export interface EntityAvailabilityChangedPayload extends EntityScope, ProvenanceFields {
  field_path: string
  before?: unknown
  after?: unknown
  occurred_at: string
}

export interface EntityOverlayChangedPayload extends EntityScope {
  /** Stable nested-content identity. Omitted by legacy root-overlay emitters. */
  node_kind?: string
  /** Stable key within node_kind. Omitted by legacy root-overlay emitters. */
  node_key?: string
  field_path: string
  locale: string
  audience: string
  market: string
  occurred_at: string
}

export interface EntityDriftDetectedPayload extends EntityScope {
  source_kind: string
  source_connection_id: string
  max_severity: DriftSeverity
  drifted_fields: string[]
  occurred_at: string
}

export interface EntityReferenceMissingPayload extends EntityScope {
  /** Module + id of the parent entity that references the now-missing one. */
  referencing_module: string
  referencing_entity_id: string
  occurred_at: string
}

export interface BookingCommittedPayload extends EntityScope, ProvenanceFields {
  booking_id: string
  occurred_at: string
}

export interface BookingCancelledPayload extends EntityScope, ProvenanceFields {
  booking_id: string
  occurred_at: string
}

export interface SourceDisconnectedPayload {
  source_kind: string
  source_connection_id: string
  affected_entity_count: number
  occurred_at: string
}

export interface SourceReconnectedPayload {
  source_kind: string
  source_connection_id: string
  restored_entity_count: number
  occurred_at: string
}

/** Map of event name → payload shape, for type-safe emit/subscribe wrappers. */
export interface CatalogEventPayloads {
  [CATALOG_EVENTS.ENTITY_CREATED]: EntityCreatedPayload
  [CATALOG_EVENTS.ENTITY_UPDATED]: EntityUpdatedPayload
  [CATALOG_EVENTS.ENTITY_ARCHIVED]: EntityArchivedPayload
  [CATALOG_EVENTS.ENTITY_DELETED]: EntityArchivedPayload
  [CATALOG_EVENTS.ENTITY_PRICE_CHANGED]: EntityPriceChangedPayload
  [CATALOG_EVENTS.ENTITY_AVAILABILITY_CHANGED]: EntityAvailabilityChangedPayload
  [CATALOG_EVENTS.ENTITY_OVERLAY_CHANGED]: EntityOverlayChangedPayload
  [CATALOG_EVENTS.ENTITY_DRIFT_DETECTED]: EntityDriftDetectedPayload
  [CATALOG_EVENTS.ENTITY_REFERENCE_MISSING]: EntityReferenceMissingPayload
  [CATALOG_EVENTS.BOOKING_COMMITTED]: BookingCommittedPayload
  [CATALOG_EVENTS.BOOKING_CANCELLED]: BookingCancelledPayload
  [CATALOG_EVENTS.SOURCE_DISCONNECTED]: SourceDisconnectedPayload
  [CATALOG_EVENTS.SOURCE_RECONNECTED]: SourceReconnectedPayload
}

// ─────────────────────────────────────────────────────────────────────────────
// Visibility filtering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filters a record of field-keyed values by the field-policy `visibility[]`
 * for the requesting audience. Fields whose policy hides them from the
 * audience are dropped entirely from the payload — never sent to the wire.
 *
 * Used to scope `before` / `after` blobs in `entity.updated` events so that
 * cross-deployment partner subscribers do not receive staff-only fields.
 */
export function filterByVisibility(
  fields: Record<string, unknown>,
  registry: FieldPolicyRegistry,
  audience: Visibility,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [path, value] of Object.entries(fields)) {
    const policy = registry.resolve(path)
    if (!policy) continue
    if (policy.visibility.includes(audience)) {
      result[path] = value
    }
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Emit helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit a catalog event through `@voyant-travel/core/events`. Stamps the metadata
 * with the canonical category for the event name and adds a `source: "service"`
 * marker.
 *
 * Visibility-filtered payloads should be constructed via `filterByVisibility`
 * before calling this — the emitter does not re-filter; the payload as
 * passed is what subscribers receive.
 */
export async function emitCatalogEvent<TName extends CatalogEventName>(
  bus: EventBus,
  name: TName,
  data: CatalogEventPayloads[TName],
  metadata?: Omit<EventMetadata, "category">,
): Promise<void> {
  const category = CATALOG_EVENT_CATEGORIES[name]
  await bus.emit(name, data, {
    category,
    source: "service",
    ...metadata,
  })
}
