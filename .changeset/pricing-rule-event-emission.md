---
"@voyantjs/pricing": minor
---

Closes #505: introduce a `pricing.rule.changed` event surface so the catalog bridge reindexes products when option-price rules are mutated.

PR4 of #493 (#506) shipped `productPricingCatalogPolicy` denormalizing `priceFromAmountCents` from `optionPriceRules` + `optionUnitPriceRules`. Until now, those tables had no event emission at all — operators editing a rule in isolation would leave the projected `priceFromAmountCents` stale until the next unrelated `product.updated`. Same operational gap PR3 closed for availability slots, but this one was scoped out of PR4 because the pricing module had no event surface to extend.

Changes:

- New `packages/pricing/src/events.ts` defining `PRICING_RULE_CHANGED_EVENT` (`"pricing.rule.changed"`) and `PricingRuleChangedEvent` (carries `productId` + `ruleId` + `kind` + `source`). `kind` is `"option-rule" | "option-unit-rule"` — the two tables PR4's projection actually reads. Other pricing tables (`option_start_time_rules`, `option_unit_tiers`, `departure_price_overrides`, pickup-price-rules, etc.) intentionally don't emit yet — extending them is its own design conversation, and emitting events no subscriber consumes is dead surface.
- `service-option-rules.ts`: the six relevant mutation functions (`createOptionPriceRule`, `updateOptionPriceRule`, `deleteOptionPriceRule`, `createOptionUnitPriceRule`, `updateOptionUnitPriceRule`, `deleteOptionUnitPriceRule`) accept an optional `RuleMutationRuntime { eventBus?, source? }` and emit after a successful commit. Existing callers that don't pass a runtime stay silent (back-compat).
- `deleteOptionPriceRule` snapshots `productId` before deletion. `optionUnitPriceRules` mutations resolve `productId` by joining through their parent `optionPriceRule` — unit rules don't carry `productId` directly.
- `routes-rules.ts`: each of the six routes threads `c.get("eventBus")` to the service. `routes-shared.ts` `Env` type extended with `eventBus?: EventBus`.
- Operator template's `catalog-bridge.ts` subscribes to `pricing.rule.changed` and reindexes the affected product, mirroring the `availability.slot.changed` subscription added in PR3.

Pre-existing gap NOT addressed here: the batch-update / batch-delete slot endpoints have the same hole (the shared batch helpers in `routes-shared.ts` don't thread the event bus through). Pricing has no batch endpoints today, so this PR doesn't add the same plumbing — when batch endpoints land or when availability's batch helpers are fixed, that fix can extend to pricing.
