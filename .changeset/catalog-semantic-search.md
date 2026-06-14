---
"@voyant-travel/catalog": minor
"@voyant-travel/trips": patch
---

Fold catalog semantic-search primitives into `@voyant-travel/catalog` and retire the first-party catalog MCP package.

`@voyant-travel/catalog` now exports embedding providers, model compatibility helpers, semantic/BYO-vector search, and cross-audience federation from catalog-owned subpaths. `@voyant-travel/trips` now owns the small local tool registry needed by its trips agent commands instead of depending on catalog MCP tooling.
