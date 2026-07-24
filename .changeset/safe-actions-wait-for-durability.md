---
"@voyant-travel/auth": minor
"@voyant-travel/catalog": minor
"@voyant-travel/charters": minor
"@voyant-travel/commerce": minor
"@voyant-travel/cruises": minor
"@voyant-travel/finance": minor
"@voyant-travel/flights": minor
"@voyant-travel/legal": minor
"@voyant-travel/notifications": minor
"@voyant-travel/quotes": minor
"@voyant-travel/relationships": minor
"@voyant-travel/setup": minor
"@voyant-travel/storefront": minor
"@voyant-travel/trips": minor
---

Keep first-party Tools with unproven non-transactional external or multi-stage effects out of
runtime discovery. The affected graph actions remain available as diagnostic metadata with an
explicit unsafe-effect reason until each package gains tested transactional, outbox, or saga
durability. This also covers supplier-side flight cancellation and contract execution whose
post-commit lifecycle event is not yet durably published.
