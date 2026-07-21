---
"@voyant-travel/framework": minor
"@voyant-travel/db": minor
"@voyant-travel/distribution": minor
"@voyant-travel/commerce": minor
"@voyant-travel/inventory": minor
---

Migrate the event outbox, channel push, promotion reindex, and product PDF
surfaces away from general workflows. Package-owned jobs are payload-free and
recover from durable domain records; product PDF generation remains an
authenticated, idempotent brochure command. The Node job host now exposes an
origin-trusted immutable inventory and best-effort terminal health reporting.
