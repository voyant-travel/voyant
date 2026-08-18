---
"@voyant-travel/commerce": patch
---

Run paid-checkout finalization without a saga-wide database transaction so each durable finance and legal step can commit its checkpoint and release locks before the next step.
