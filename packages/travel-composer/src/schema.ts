import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { relations } from "drizzle-orm"
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const tripEnvelopeStatusEnum = pgEnum("trip_envelope_status", [
  "draft",
  "priced",
  "reserve_in_progress",
  "reserved",
  "checkout_started",
  "booked",
  "failed",
  "cancelled",
])

export const tripComponentKindEnum = pgEnum("trip_component_kind", [
  "catalog_booking",
  "manual_placeholder",
  "flight_placeholder",
  "flight_order",
  "external_order",
])

export const tripComponentStatusEnum = pgEnum("trip_component_status", [
  "draft",
  "priced",
  "unavailable",
  "held",
  "booked",
  "checkout_started",
  "failed",
  "cancelled",
  "removed",
])

export const tripComponentEventTypeEnum = pgEnum("trip_component_event_type", [
  "created",
  "updated",
  "priced",
  "hold_placed",
  "booked",
  "checkout_started",
  "failed",
  "cancelled",
  "removed",
  "staff_remediation_required",
])

export type TripEnvelopePricingSnapshot = {
  currency: string
  subtotalAmountCents: number
  taxAmountCents: number
  totalAmountCents: number
  componentCount: number
  pricedComponentCount: number
  warnings?: string[]
}

export type TripComponentPricingSnapshot = {
  currency: string
  subtotalAmountCents: number
  taxAmountCents: number
  totalAmountCents: number
  priceExpiresAt?: string
  warnings?: string[]
}

export type TripComponentTaxLineSnapshot = {
  code: string
  label: string
  amountCents: number
  baseAmountCents: number
  rate?: number
  jurisdiction?: string
  includedInPrice?: boolean
  source?: string
}

export const tripEnvelopes = pgTable(
  "trip_envelopes",
  {
    id: typeId("trip_envelopes"),
    status: tripEnvelopeStatusEnum("status").notNull().default("draft"),
    title: text("title"),
    description: text("description"),

    travelerParty: jsonb("traveler_party").$type<Record<string, unknown>>().notNull().default({}),
    constraints: jsonb("constraints").$type<Record<string, unknown>>().notNull().default({}),

    aggregateCurrency: text("aggregate_currency"),
    aggregateSubtotalAmountCents: integer("aggregate_subtotal_amount_cents"),
    aggregateTaxAmountCents: integer("aggregate_tax_amount_cents"),
    aggregateTotalAmountCents: integer("aggregate_total_amount_cents"),
    aggregatePricingSnapshot: jsonb(
      "aggregate_pricing_snapshot",
    ).$type<TripEnvelopePricingSnapshot>(),
    currentPriceExpiresAt: timestamp("current_price_expires_at", { withTimezone: true }),

    bookingGroupId: text("booking_group_id"),
    orderId: text("order_id"),
    paymentSessionId: text("payment_session_id"),
    reserveIdempotencyKey: text("reserve_idempotency_key"),
    reserveStartedAt: timestamp("reserve_started_at", { withTimezone: true }),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
    checkoutIdempotencyKey: text("checkout_idempotency_key"),
    checkoutStartedAt: timestamp("checkout_started_at", { withTimezone: true }),

    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_trip_envelopes_status_updated").on(table.status, table.updatedAt),
    index("idx_trip_envelopes_created_by_updated").on(table.createdBy, table.updatedAt),
    index("idx_trip_envelopes_booking_group").on(table.bookingGroupId),
    index("idx_trip_envelopes_payment_session").on(table.paymentSessionId),
    index("idx_trip_envelopes_reserve_idempotency").on(table.reserveIdempotencyKey),
    index("idx_trip_envelopes_checkout_idempotency").on(table.checkoutIdempotencyKey),
  ],
)

export const tripComponents = pgTable(
  "trip_components",
  {
    id: typeId("trip_components"),
    envelopeId: typeIdRef("envelope_id")
      .notNull()
      .references(() => tripEnvelopes.id, { onDelete: "cascade" }),

    sequence: integer("sequence").notNull().default(0),
    kind: tripComponentKindEnum("kind").notNull(),
    status: tripComponentStatusEnum("status").notNull().default("draft"),
    title: text("title"),
    description: text("description"),

    entityModule: text("entity_module"),
    entityId: text("entity_id"),
    sourceKind: text("source_kind"),
    sourceConnectionId: text("source_connection_id"),
    sourceRef: text("source_ref"),

    bookingDraftId: text("booking_draft_id"),
    catalogQuoteId: text("catalog_quote_id"),
    bookingId: text("booking_id"),
    bookingGroupId: text("booking_group_id"),
    orderId: text("order_id"),
    paymentSessionId: text("payment_session_id"),
    providerRef: text("provider_ref"),
    supplierRef: text("supplier_ref"),

    componentCurrency: text("component_currency"),
    componentSubtotalAmountCents: integer("component_subtotal_amount_cents"),
    componentTaxAmountCents: integer("component_tax_amount_cents"),
    componentTotalAmountCents: integer("component_total_amount_cents"),
    pricingSnapshot: jsonb("pricing_snapshot").$type<TripComponentPricingSnapshot>(),
    taxLines: jsonb("tax_lines").$type<TripComponentTaxLineSnapshot[]>().default([]),
    cancellationSnapshot: jsonb("cancellation_snapshot").$type<Record<string, unknown>>(),

    holdToken: text("hold_token"),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    priceExpiresAt: timestamp("price_expires_at", { withTimezone: true }),
    warningCodes: jsonb("warning_codes").$type<string[]>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_trip_components_envelope_sequence").on(table.envelopeId, table.sequence),
    index("idx_trip_components_envelope_status").on(table.envelopeId, table.status),
    index("idx_trip_components_catalog_entity").on(table.entityModule, table.entityId),
    index("idx_trip_components_booking_draft").on(table.bookingDraftId),
    index("idx_trip_components_catalog_quote").on(table.catalogQuoteId),
    index("idx_trip_components_booking").on(table.bookingId),
    index("idx_trip_components_order").on(table.orderId),
    index("idx_trip_components_payment_session").on(table.paymentSessionId),
  ],
)

export const tripComponentEvents = pgTable(
  "trip_component_events",
  {
    id: typeId("trip_component_events"),
    envelopeId: typeIdRef("envelope_id")
      .notNull()
      .references(() => tripEnvelopes.id, { onDelete: "cascade" }),
    componentId: typeIdRef("component_id").references(() => tripComponents.id, {
      onDelete: "set null",
    }),
    eventType: tripComponentEventTypeEnum("event_type").notNull(),
    fromStatus: tripComponentStatusEnum("from_status"),
    toStatus: tripComponentStatusEnum("to_status"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    actorId: text("actor_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_trip_component_events_envelope_time").on(table.envelopeId, table.occurredAt),
    index("idx_trip_component_events_component_time").on(table.componentId, table.occurredAt),
    index("idx_trip_component_events_type_time").on(table.eventType, table.occurredAt),
  ],
)

export const tripEnvelopeRelations = relations(tripEnvelopes, ({ many }) => ({
  components: many(tripComponents),
  events: many(tripComponentEvents),
}))

export const tripComponentRelations = relations(tripComponents, ({ one, many }) => ({
  envelope: one(tripEnvelopes, {
    fields: [tripComponents.envelopeId],
    references: [tripEnvelopes.id],
  }),
  events: many(tripComponentEvents),
}))

export const tripComponentEventRelations = relations(tripComponentEvents, ({ one }) => ({
  envelope: one(tripEnvelopes, {
    fields: [tripComponentEvents.envelopeId],
    references: [tripEnvelopes.id],
  }),
  component: one(tripComponents, {
    fields: [tripComponentEvents.componentId],
    references: [tripComponents.id],
  }),
}))

export type TripEnvelope = typeof tripEnvelopes.$inferSelect
export type NewTripEnvelope = typeof tripEnvelopes.$inferInsert
export type TripComponent = typeof tripComponents.$inferSelect
export type NewTripComponent = typeof tripComponents.$inferInsert
export type TripComponentEvent = typeof tripComponentEvents.$inferSelect
export type NewTripComponentEvent = typeof tripComponentEvents.$inferInsert
