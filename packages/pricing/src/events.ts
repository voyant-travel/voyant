/**
 * Pricing domain events.
 *
 * Emitted (after commit) by paths that mutate pricing rules feeding the
 * catalog-plane `priceFromAmountCents` projection (PR4 of #493). The
 * catalog bridge subscribes to these and reindexes the affected
 * product so the denormalized "from $X" stays in sync without a full
 * reindex run.
 *
 * Subscriber contract: treat the payload as a *trigger*, not the source
 * of truth. Re-read the row(s) before acting on them — concurrent edits
 * may have superseded the snapshot in this payload.
 *
 * Per docs/architecture/channel-push-architecture.md §5.1 (same shape as
 * `availability.slot.changed`).
 *
 * Today's surface covers `option_price_rules` + `option_unit_price_rules`
 * — the two tables that feed PR4's MIN aggregation. Other pricing
 * tables (`option_start_time_rules`, `option_unit_tiers`,
 * `departure_price_overrides`, `pickup_price_rules`, `cancellation_*`)
 * intentionally do NOT emit yet: extending the catalog projection to
 * read them is its own design conversation and emitting an event no
 * subscriber consumes is dead surface area. When a future projection
 * grows to read one of those tables, extend `kind` and add emission to
 * the corresponding service function.
 */

/** Stable string identifier for the event. */
export const PRICING_RULE_CHANGED_EVENT = "pricing.rule.changed" as const

/** Origin of the change. Diagnostic only — subscribers don't behave
 *  differently on this field, but it's preserved end-to-end so logs
 *  and dashboards can attribute drift to a cause. */
export type PricingRuleChangeSource = "created" | "updated" | "deleted"

/**
 * Which pricing-rule table the mutation touched. Lets a subscriber
 * filter without re-reading the row (e.g. a future projection that
 * only cares about `option-rule` mutations can skip per-unit deltas).
 */
export type PricingRuleKind = "option-rule" | "option-unit-rule"

export interface PricingRuleChangedEvent {
  /**
   * The product whose pricing surface changed. Subscribers reindex
   * this product. Always set — every relevant rule belongs to a
   * product (option-unit rules join through their parent option-rule
   * to find the product).
   */
  productId: string
  /** The mutated row's id, for diagnostics. */
  ruleId: string
  /** Which table was touched. */
  kind: PricingRuleKind
  source: PricingRuleChangeSource
}
