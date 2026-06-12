---
"@voyantjs/bookings": patch
---

Resource capacity check no longer runs one `COUNT(DISTINCT ...)` query per allocation entry: all checked (kind, resource) pairs are counted in ONE grouped query via a `VALUES` join (2 queries total — the unchanged `FOR UPDATE` lock plus the grouped count — instead of 1 + N). Semantics are unchanged: same lock, same per-resource violations and error messages, missing/mismatched resources still reported without a count.
