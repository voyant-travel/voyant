---
"@voyantjs/pricing": patch
---

Resolve option price rules by date via priceSchedule + RRULE (#465).

The pricing schema has supported seasonal rules (priceSchedule with recurrenceRule, validFrom/validTo, priority) for some time, but the public snapshot returned every active rule and left selection to the caller — schedules were never evaluated. This forced operators into the wrong shape (one rule per departure) to make pricing work.

- Adds `service-rule-resolver` with pure `pickRulesForDate()` and DB-backed `resolveOptionPriceRulesForDate()`. Highest priority wins; ties break on `isDefault` then `name`; rules without a schedule act as a default fallback.
- Wires the resolver into `publicPricingService.getProductPricingSnapshot` via new optional `date` / `departureId` query params; `departureId` resolves through `availabilitySlots.dateLocal`.
- Adds `rrule` (edge-safe; only `tslib` dep) for RRULE evaluation.

Behavior is backward-compatible: when neither `date` nor `departureId` is passed the snapshot still returns every active rule (admin-friendly). Booking-engine integration deferred to #468.
