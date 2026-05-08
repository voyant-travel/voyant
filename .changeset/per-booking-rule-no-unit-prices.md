---
"@voyantjs/pricing": patch
"@voyantjs/i18n": patch
---

Reject the contradictory combination of `option_price_rules.pricing_mode = "per_booking"` and child per-unit prices, and stop the admin UI from offering the unit-pricing matrix on a per-booking rule (#482).

Before: an `option_price_rule` with `pricingMode = "per_booking"` could carry rows in `option_unit_price_rules`. The storefront totaller in `service-departures.ts` switches on the *unit-level* `pricingMode`, so the rule-level `per_booking` badge was effectively cosmetic — the rule said "single flat amount per booking", the math actually multiplied per-unit prices by quantity. Operators saw "Per Booking" and reasonably expected a flat charge; the system did something different.

After:

- `pricingService.createOptionUnitPriceRule` rejects (400) creating a unit-price row whose parent rule has `pricingMode = "per_booking"`.
- `pricingService.updateOptionPriceRule` rejects (400) flipping a rule to `pricingMode = "per_booking"` when child unit-price rows already exist.
- The product-options pricing form in the operator template and apps/dev hides the unit-pricing matrix when the rule is per-booking and shows a helper pointing the user at Per Person / Starting From if they want unit-level prices.
- New i18n key `priceRules.perBookingFlatHint` (en + ro).

Choosing one mode over the other isn't lossy — operators on rules currently configured as `per_booking` with unit prices were already getting the unit-level math; the badge will now match the math after they switch the rule's mode (typically to `per_person` or `per_unit` at the unit level).
