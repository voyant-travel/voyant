---
"@voyantjs/catalog": minor
"@voyantjs/trip-composer": patch
---

Fold catalog semantic-search primitives into `@voyantjs/catalog` and retire the first-party catalog MCP package.

`@voyantjs/catalog` now exports embedding providers, model compatibility helpers, semantic/BYO-vector search, and cross-audience federation from catalog-owned subpaths. `@voyantjs/trip-composer` now owns the small local tool registry needed by its trip-composer agent commands instead of depending on catalog MCP tooling.
