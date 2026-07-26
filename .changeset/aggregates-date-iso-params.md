---
"@voyant-travel/distribution": patch
"@voyant-travel/operations": patch
---

Bind aggregate date-range SQL params as ISO strings so timestamptz comparisons do not receive Date#toString() values.
