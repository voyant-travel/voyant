---
"@voyant-travel/commerce-react": patch
"@voyant-travel/ui": patch
---

Fix the Settings → Price Catalogs create form silently dropping a typed currency. The currency control is a combobox whose committed value only changed when a row was picked from the list, so typing a code like `EUR` and submitting persisted a blank currency. The shared `CurrencyCombobox` now commits a fully-typed ISO code (case-insensitive) even when the matching row is never selected, and the price catalog form reuses that canonical picker instead of a local one that did not bind typed text to the form value. The currency input also forwards an `id`, and the price catalog dialog fields now associate their `<Label htmlFor>` with the inputs.
