---
"@voyant-travel/commerce": patch
"@voyant-travel/storefront": patch
---

Stop a bookable departure from rendering "price on request" when an option has a stray empty default rate plan (#1601).

- **commerce** — `createOptionPriceRule`/`updateOptionPriceRule` now enforce a single active default rate plan per `(option, price catalog)`. Writing or promoting a default plan demotes any sibling default in the same scope inside a transaction, so a save path can no longer fan out several active `is_default` rows where only the newest carries prices.
- **storefront** — the public departures pricing reader now prefers a rate plan that actually carries a price (positive base amount or a priced active unit rule) before falling back to the `is_default` flag, so a stray empty default can't mask the real priced plan and force a "price on request".
