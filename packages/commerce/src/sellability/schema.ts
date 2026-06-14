import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const sellabilitySnapshotStatusEnum = pgEnum("sellability_snapshot_status", [
  "resolved",
  "offer_constructed",
  "expired",
])

export const sellabilitySnapshotComponentKindEnum = pgEnum("sellability_snapshot_component_kind", [
  "base",
  "unit",
  "pickup",
  "start_time_adjustment",
])

export const sellabilityPolicyScopeEnum = pgEnum("sellability_policy_scope", [
  "global",
  "product",
  "option",
  "market",
  "channel",
])

export const sellabilityPolicyTypeEnum = pgEnum("sellability_policy_type", [
  "capability",
  "occupancy",
  "pickup",
  "question",
  "allotment",
  "availability_window",
  "currency",
  "custom",
])

export const sellabilityPolicyResultStatusEnum = pgEnum("sellability_policy_result_status", [
  "passed",
  "blocked",
  "warning",
  "adjusted",
])

export const offerRefreshRunStatusEnum = pgEnum("offer_refresh_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "expired",
])

export const offerExpirationEventStatusEnum = pgEnum("offer_expiration_event_status", [
  "scheduled",
  "expired",
  "cancelled",
  "superseded",
])

export const sellabilityExplanationTypeEnum = pgEnum("sellability_explanation_type", [
  "sellable",
  "blocked",
  "warning",
  "pricing",
  "allotment",
  "pickup",
  "policy",
])

export const sellabilitySnapshots = pgTable(
  "sellability_snapshots",
  {
    id: typeId("sellability_snapshots"),
    offerId: text("offer_id"),
    marketId: text("market_id"),
    channelId: text("channel_id"),
    productId: text("product_id"),
    optionId: text("option_id"),
    slotId: text("slot_id"),
    requestedCurrencyCode: text("requested_currency_code"),
    sourceCurrencyCode: text("source_currency_code"),
    fxRateSetId: text("fx_rate_set_id"),
    status: sellabilitySnapshotStatusEnum("status").notNull().default("resolved"),
    queryPayload: jsonb("query_payload").$type<Record<string, unknown>>().notNull(),
    pricingSummary: jsonb("pricing_summary").$type<Record<string, unknown>>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sellability_snapshots_updated").on(table.updatedAt),
    index("idx_sellability_snapshots_offer_updated").on(table.offerId, table.updatedAt),
    index("idx_sellability_snapshots_market_updated").on(table.marketId, table.updatedAt),
    index("idx_sellability_snapshots_channel_updated").on(table.channelId, table.updatedAt),
    index("idx_sellability_snapshots_product_updated").on(table.productId, table.updatedAt),
    index("idx_sellability_snapshots_option_updated").on(table.optionId, table.updatedAt),
    index("idx_sellability_snapshots_slot_updated").on(table.slotId, table.updatedAt),
    index("idx_sellability_snapshots_status_updated").on(table.status, table.updatedAt),
  ],
)

export const sellabilitySnapshotItems = pgTable(
  "sellability_snapshot_items",
  {
    id: typeId("sellability_snapshot_items"),
    snapshotId: typeIdRef("snapshot_id")
      .notNull()
      .references(() => sellabilitySnapshots.id, { onDelete: "cascade" }),
    candidateIndex: integer("candidate_index").notNull().default(0),
    componentIndex: integer("component_index").notNull().default(0),
    productId: text("product_id"),
    optionId: text("option_id"),
    slotId: text("slot_id"),
    unitId: text("unit_id"),
    requestRef: text("request_ref"),
    componentKind: sellabilitySnapshotComponentKindEnum("component_kind").notNull(),
    title: text("title").notNull(),
    quantity: integer("quantity").notNull().default(1),
    pricingMode: text("pricing_mode").notNull(),
    pricingCategoryId: text("pricing_category_id"),
    pricingCategoryName: text("pricing_category_name"),
    unitName: text("unit_name"),
    unitType: text("unit_type"),
    currencyCode: text("currency_code").notNull(),
    sellAmountCents: integer("sell_amount_cents").notNull().default(0),
    costAmountCents: integer("cost_amount_cents").notNull().default(0),
    sourceRuleId: text("source_rule_id"),
    tierId: text("tier_id"),
    isSelected: boolean("is_selected").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sellability_snapshot_items_snapshot_order").on(
      table.snapshotId,
      table.candidateIndex,
      table.componentIndex,
    ),
    index("idx_sellability_snapshot_items_product_order").on(
      table.productId,
      table.candidateIndex,
      table.componentIndex,
    ),
    index("idx_sellability_snapshot_items_option_order").on(
      table.optionId,
      table.candidateIndex,
      table.componentIndex,
    ),
    index("idx_sellability_snapshot_items_slot_order").on(
      table.slotId,
      table.candidateIndex,
      table.componentIndex,
    ),
    index("idx_sellability_snapshot_items_unit_order").on(
      table.unitId,
      table.candidateIndex,
      table.componentIndex,
    ),
    index("idx_sellability_snapshot_items_candidate").on(table.candidateIndex),
    index("idx_sellability_snapshot_items_component").on(table.componentKind),
  ],
)

export const sellabilityPolicies = pgTable(
  "sellability_policies",
  {
    id: typeId("sellability_policies"),
    name: text("name").notNull(),
    scope: sellabilityPolicyScopeEnum("scope").notNull().default("global"),
    policyType: sellabilityPolicyTypeEnum("policy_type").notNull().default("custom"),
    productId: text("product_id"),
    optionId: text("option_id"),
    marketId: text("market_id"),
    channelId: text("channel_id"),
    priority: integer("priority").notNull().default(0),
    active: boolean("active").notNull().default(true),
    conditions: jsonb("conditions").$type<Record<string, unknown>>().notNull().default({}),
    effects: jsonb("effects").$type<Record<string, unknown>>().notNull().default({}),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sellability_policies_priority_name").on(table.priority, table.name),
    index("idx_sellability_policies_scope_priority_name").on(
      table.scope,
      table.priority,
      table.name,
    ),
    index("idx_sellability_policies_type_priority_name").on(
      table.policyType,
      table.priority,
      table.name,
    ),
    index("idx_sellability_policies_product_priority_name").on(
      table.productId,
      table.priority,
      table.name,
    ),
    index("idx_sellability_policies_option_priority_name").on(
      table.optionId,
      table.priority,
      table.name,
    ),
    index("idx_sellability_policies_market_priority_name").on(
      table.marketId,
      table.priority,
      table.name,
    ),
    index("idx_sellability_policies_channel_priority_name").on(
      table.channelId,
      table.priority,
      table.name,
    ),
    index("idx_sellability_policies_active_priority_name").on(
      table.active,
      table.priority,
      table.name,
    ),
  ],
)

export const sellabilityPolicyResults = pgTable(
  "sellability_policy_results",
  {
    id: typeId("sellability_policy_results"),
    snapshotId: typeIdRef("snapshot_id")
      .notNull()
      .references(() => sellabilitySnapshots.id, { onDelete: "cascade" }),
    snapshotItemId: typeIdRef("snapshot_item_id").references(() => sellabilitySnapshotItems.id, {
      onDelete: "set null",
    }),
    policyId: typeIdRef("policy_id").references(() => sellabilityPolicies.id, {
      onDelete: "set null",
    }),
    candidateIndex: integer("candidate_index").notNull().default(0),
    status: sellabilityPolicyResultStatusEnum("status").notNull().default("passed"),
    message: text("message"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sellability_policy_results_snapshot_created").on(table.snapshotId, table.createdAt),
    index("idx_sellability_policy_results_snapshot_item_created").on(
      table.snapshotItemId,
      table.createdAt,
    ),
    index("idx_sellability_policy_results_policy_created").on(table.policyId, table.createdAt),
    index("idx_sellability_policy_results_status_created").on(table.status, table.createdAt),
  ],
)

export const offerRefreshRuns = pgTable(
  "offer_refresh_runs",
  {
    id: typeId("offer_refresh_runs"),
    offerId: text("offer_id").notNull(),
    snapshotId: typeIdRef("snapshot_id").references(() => sellabilitySnapshots.id, {
      onDelete: "set null",
    }),
    status: offerRefreshRunStatusEnum("status").notNull().default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_offer_refresh_runs_offer_started").on(table.offerId, table.startedAt),
    index("idx_offer_refresh_runs_snapshot_started").on(table.snapshotId, table.startedAt),
    index("idx_offer_refresh_runs_status_started").on(table.status, table.startedAt),
  ],
)

export const offerExpirationEvents = pgTable(
  "offer_expiration_events",
  {
    id: typeId("offer_expiration_events"),
    offerId: text("offer_id").notNull(),
    snapshotId: typeIdRef("snapshot_id").references(() => sellabilitySnapshots.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    status: offerExpirationEventStatusEnum("status").notNull().default("scheduled"),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_offer_expiration_events_offer_expires").on(table.offerId, table.expiresAt),
    index("idx_offer_expiration_events_snapshot_expires").on(table.snapshotId, table.expiresAt),
    index("idx_offer_expiration_events_status_expires").on(table.status, table.expiresAt),
  ],
)

export const sellabilityExplanations = pgTable(
  "sellability_explanations",
  {
    id: typeId("sellability_explanations"),
    snapshotId: typeIdRef("snapshot_id")
      .notNull()
      .references(() => sellabilitySnapshots.id, { onDelete: "cascade" }),
    snapshotItemId: typeIdRef("snapshot_item_id").references(() => sellabilitySnapshotItems.id, {
      onDelete: "set null",
    }),
    candidateIndex: integer("candidate_index").notNull().default(0),
    explanationType: sellabilityExplanationTypeEnum("explanation_type").notNull().default("policy"),
    code: text("code"),
    message: text("message").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_sellability_explanations_snapshot_created").on(table.snapshotId, table.createdAt),
    index("idx_sellability_explanations_snapshot_item_created").on(
      table.snapshotItemId,
      table.createdAt,
    ),
    index("idx_sellability_explanations_type_created").on(table.explanationType, table.createdAt),
  ],
)

export type SellabilitySnapshot = typeof sellabilitySnapshots.$inferSelect
export type NewSellabilitySnapshot = typeof sellabilitySnapshots.$inferInsert
export type SellabilitySnapshotItem = typeof sellabilitySnapshotItems.$inferSelect
export type NewSellabilitySnapshotItem = typeof sellabilitySnapshotItems.$inferInsert
export type SellabilityPolicy = typeof sellabilityPolicies.$inferSelect
export type NewSellabilityPolicy = typeof sellabilityPolicies.$inferInsert
export type SellabilityPolicyResult = typeof sellabilityPolicyResults.$inferSelect
export type NewSellabilityPolicyResult = typeof sellabilityPolicyResults.$inferInsert
export type OfferRefreshRun = typeof offerRefreshRuns.$inferSelect
export type NewOfferRefreshRun = typeof offerRefreshRuns.$inferInsert
export type OfferExpirationEvent = typeof offerExpirationEvents.$inferSelect
export type NewOfferExpirationEvent = typeof offerExpirationEvents.$inferInsert
export type SellabilityExplanation = typeof sellabilityExplanations.$inferSelect
export type NewSellabilityExplanation = typeof sellabilityExplanations.$inferInsert

export const sellabilitySnapshotsRelations = relations(sellabilitySnapshots, ({ many }) => ({
  items: many(sellabilitySnapshotItems),
  policyResults: many(sellabilityPolicyResults),
  explanations: many(sellabilityExplanations),
  refreshRuns: many(offerRefreshRuns),
  expirationEvents: many(offerExpirationEvents),
}))

export const sellabilitySnapshotItemsRelations = relations(sellabilitySnapshotItems, ({ one }) => ({
  snapshot: one(sellabilitySnapshots, {
    fields: [sellabilitySnapshotItems.snapshotId],
    references: [sellabilitySnapshots.id],
  }),
}))

export const sellabilityPoliciesRelations = relations(sellabilityPolicies, ({ many }) => ({
  results: many(sellabilityPolicyResults),
}))

export const sellabilityPolicyResultsRelations = relations(sellabilityPolicyResults, ({ one }) => ({
  snapshot: one(sellabilitySnapshots, {
    fields: [sellabilityPolicyResults.snapshotId],
    references: [sellabilitySnapshots.id],
  }),
  snapshotItem: one(sellabilitySnapshotItems, {
    fields: [sellabilityPolicyResults.snapshotItemId],
    references: [sellabilitySnapshotItems.id],
  }),
  policy: one(sellabilityPolicies, {
    fields: [sellabilityPolicyResults.policyId],
    references: [sellabilityPolicies.id],
  }),
}))

export const offerRefreshRunsRelations = relations(offerRefreshRuns, ({ one }) => ({
  snapshot: one(sellabilitySnapshots, {
    fields: [offerRefreshRuns.snapshotId],
    references: [sellabilitySnapshots.id],
  }),
}))

export const offerExpirationEventsRelations = relations(offerExpirationEvents, ({ one }) => ({
  snapshot: one(sellabilitySnapshots, {
    fields: [offerExpirationEvents.snapshotId],
    references: [sellabilitySnapshots.id],
  }),
}))

export const sellabilityExplanationsRelations = relations(sellabilityExplanations, ({ one }) => ({
  snapshot: one(sellabilitySnapshots, {
    fields: [sellabilityExplanations.snapshotId],
    references: [sellabilitySnapshots.id],
  }),
  snapshotItem: one(sellabilitySnapshotItems, {
    fields: [sellabilityExplanations.snapshotItemId],
    references: [sellabilitySnapshotItems.id],
  }),
}))
