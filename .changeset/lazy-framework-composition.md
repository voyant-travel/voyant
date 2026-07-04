---
"@voyant-travel/framework": patch
"@voyant-travel/hono": patch
"@voyant-travel/commerce": patch
"@voyant-travel/finance": patch
---

Split the framework standard runtime composition into lightweight per-module
lazy route loaders, and allow overlapping lazy route mounts to fall through on
wrapper route misses so lazy modules/extensions preserve eager route composition
semantics without swallowing handler-authored 404 responses.
