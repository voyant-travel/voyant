---
"@voyant-travel/framework": patch
---

Treat omitted action availability as callable once lifecycle, effect-boundary, or
durability metadata is present, so removing an unavailable marker cannot bypass
stable-target and tested-durability validation.
