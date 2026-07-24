---
"@voyant-travel/commerce": major
"@voyant-travel/charters": major
"@voyant-travel/cruises": major
---

Require a stable `idempotencyKey` for cancellation-policy, price-catalog,
charter-product, charter-yacht, and cruise-ship create Tools. Successful calls
now return an immutable created-target reference (`status`, target `id`, and
`replayed`) instead of a mutable full-row snapshot. Exact retries return the
original reference and altered same-key commands conflict.
