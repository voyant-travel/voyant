/**
 * Promotional offers schema — three tables backing the promotions module.
 *
 * Per docs/architecture/promotions-architecture.md §4:
 *   - `promotional_offers` (root): the offer header (name, discount type/value,
 *     scope JSONB, conditions JSONB, validity window, optional code).
 *   - `promotional_offer_products` (link): denormalized materialization of the
 *     offer's product set for the product-shaped scopes (`products`,
 *     `categories`, `destinations`). Slice-shaped scopes (`global`, `markets`,
 *     `audiences`) leave this table empty for that offer.
 *   - `promotional_offer_redemptions` (audit): one row per (offer, booking).
 *     Aggregated by the redemption recorder when a booking spans multiple
 *     line-item snapshots that share an applied offer.
 *
 * Cross-module FK rules: `product_id` and `booking_id` are plain `text`
 * columns with no `.references()` per the cross-module decoupling rule
 * (see docs/architecture/schema-discipline.md). Cross-module integrity is
 * enforced at the service layer.
 */

import { typeId } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import type { PromotionalOfferConditions, PromotionalOfferScope } from "./validation.js"

export const promotionalOfferDiscountTypeEnum = pgEnum("promotional_offer_discount_type", [
  "percentage",
  "fixed_amount",
])

export type PromotionalOfferDiscountType =
  (typeof promotionalOfferDiscountTypeEnum.enumValues)[number]

export const promotionalOffers = pgTable(
  "promotional_offers",
  {
    id: typeId("promotional_offers"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    discountType: promotionalOfferDiscountTypeEnum("discount_type").notNull(),
    /** Required when `discountType = 'percentage'`. e.g. 20.00 → 20% off. */
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }),
    /** Required when `discountType = 'fixed_amount'`. */
    discountAmountCents: integer("discount_amount_cents"),
    /** Required when `discountType = 'fixed_amount'`. ISO 4217. */
    currency: text("currency"),
    /** Discriminated union — see §3.2. Source of truth for editing. */
    scope: jsonb("scope").$type<PromotionalOfferScope>().notNull(),
    /** Typed JSONB; `{ minPax?: number }` in v1. */
    conditions: jsonb("conditions").$type<PromotionalOfferConditions>().notNull().default({}),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    /** NULL = auto-applied. Non-NULL = code-gated; stored lowercase. */
    code: text("code"),
    stackable: boolean("stackable").notNull().default(false),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Hot-path range scan for the rule evaluator: "all currently-valid active offers".
    index("idx_promotional_offers_active_validity").on(
      table.active,
      table.validFrom,
      table.validUntil,
    ),
    // Slugs unique across active rows; archiving frees up the slug for reuse.
    uniqueIndex("uidx_promotional_offers_slug_active").on(table.slug).where(sql`active = true`),
    // Code uniqueness: case-insensitive (stored lowercase, compared lowercase),
    // active rows only. Archived offers can recycle their code.
    uniqueIndex("uidx_promotional_offers_code_active")
      .on(sql`lower(code)`)
      .where(sql`code is not null and active = true`),
  ],
)

/**
 * Denormalized scope materialization. Populated by the service layer on
 * offer create/update for `scope.kind ∈ {products, categories, destinations}`.
 * The catalog projection joins against this table on the hot path.
 *
 * `product_id` is a plain text column — no Drizzle `.references()` per the
 * cross-module decoupling rule.
 */
export const promotionalOfferProducts = pgTable(
  "promotional_offer_products",
  {
    offerId: text("offer_id")
      .notNull()
      .references(() => promotionalOffers.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.offerId, table.productId] }),
    index("idx_pop_product").on(table.productId),
  ],
)

/**
 * Per-booking redemption record. ON DELETE RESTRICT on `offer_id` so an
 * offer with redemptions cannot be deleted (operators must archive instead).
 *
 * The `(offer_id, booking_id)` unique constraint enforces "one row per
 * (offer, booking)" — the redemption recorder aggregates `discount_applied_cents`
 * across multiple line-item snapshots that share an offer before inserting,
 * and the recorder upsert (`ON CONFLICT … DO UPDATE`) is idempotent against
 * subscriber retries.
 */
export const promotionalOfferRedemptions = pgTable(
  "promotional_offer_redemptions",
  {
    id: typeId("promotional_offer_redemptions"),
    offerId: text("offer_id")
      .notNull()
      .references(() => promotionalOffers.id, { onDelete: "restrict" }),
    bookingId: text("booking_id").notNull(),
    /** The literal code the customer entered (case preserved); NULL for auto-applied. */
    codeUsed: text("code_used"),
    discountAppliedCents: integer("discount_applied_cents").notNull(),
    currency: text("currency").notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_por_offer").on(table.offerId),
    index("idx_por_booking").on(table.bookingId),
    uniqueIndex("uidx_por_offer_booking").on(table.offerId, table.bookingId),
  ],
)

export type PromotionalOffer = typeof promotionalOffers.$inferSelect
export type NewPromotionalOffer = typeof promotionalOffers.$inferInsert
export type PromotionalOfferProduct = typeof promotionalOfferProducts.$inferSelect
export type NewPromotionalOfferProduct = typeof promotionalOfferProducts.$inferInsert
export type PromotionalOfferRedemption = typeof promotionalOfferRedemptions.$inferSelect
export type NewPromotionalOfferRedemption = typeof promotionalOfferRedemptions.$inferInsert

/**
 * Boundary-scheduler watermark — a single row tracking the last_tick the
 * boundary scheduler observed. Per §9.2 of the architecture doc, the
 * scheduler queries offers whose `valid_from` / `valid_until` falls
 * BETWEEN `last_tick` and `now()` to detect lifecycle transitions.
 *
 * Single-row convention: rows are upserted with id = `BOUNDARY_SCHEDULER_STATE_ID`
 * (typeid `pofs_default`). The unique constraint on `singleton_key` enforces
 * "at most one row" defensively even if a future caller forgot the convention.
 */
export const promotionalOfferSchedulerState = pgTable(
  "promotional_offer_scheduler_state",
  {
    id: typeId("promotional_offer_scheduler_state"),
    /**
     * Sentinel column for single-row enforcement — always set to
     * `'singleton'`. The unique index on this column means a second
     * insert with a different id would still fail.
     */
    singletonKey: text("singleton_key").notNull().default("singleton"),
    lastTick: timestamp("last_tick", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uidx_pofs_singleton").on(table.singletonKey)],
)

export type PromotionalOfferSchedulerState = typeof promotionalOfferSchedulerState.$inferSelect
export type NewPromotionalOfferSchedulerState = typeof promotionalOfferSchedulerState.$inferInsert

/**
 * Durable coalescing checkpoint for catalog-wide promotion reindex requests.
 * A subscriber increments requestedGeneration before returning. The job only
 * advances completedGeneration after every current product has been reindexed;
 * concurrent requests therefore remain visible for the next drain.
 */
export const promotionReindexState = pgTable("promotion_reindex_state", {
  id: text("id").primaryKey().default("all-products"),
  requestedGeneration: integer("requested_generation").notNull().default(0),
  completedGeneration: integer("completed_generation").notNull().default(0),
  claimedGeneration: integer("claimed_generation"),
  leaseOwner: text("lease_owner"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type PromotionReindexState = typeof promotionReindexState.$inferSelect
