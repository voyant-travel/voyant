---
"@voyant-travel/distribution": major
"@voyant-travel/legal": major
---

Require `idempotencyKey` for the supplier, distribution-channel, and legal
contract-draft create Tools. Successful calls now return an immutable created
target reference (`status`, the target `id`, and `replayed`) instead of a mutable
full-row snapshot. Equal keys replay the original target; reusing a key with
different command input fails with an idempotency conflict.
