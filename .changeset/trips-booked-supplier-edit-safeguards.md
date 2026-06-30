---
"@voyant-travel/trips": patch
---

Block traveler, billing, and supplier-backed component detail edits once a trip
has committed supplier-backed components, requiring a structured amendment path
instead of accepting local-only changes that leave downstream orders stale.
