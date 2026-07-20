---
"@voyant-travel/bookings-react": patch
---

Don't flag a pristine booking journey as un-priceable. Opening the journey for a product whose price depends on a later selection (a room to pick, travelers to add) showed the "This selection can't be priced right now" banner and a raw `no_sell_amount_configured` engine code on step 1, before the buyer had chosen anything — making a bookable product look broken. The un-priceable banner and side-panel error are now suppressed for that pristine baseline and only surface once a price driver is configured (or for a genuinely un-priceable reason like `rates_missing`); the side panel shows a human-readable message instead of the raw code. Commit gating is unchanged, so an unpriced booking still can't be submitted.
