---
"@voyantjs/catalog": minor
"@voyantjs/trips": patch
---

Fold catalog semantic-search primitives into `@voyantjs/catalog` and retire the first-party catalog MCP package.

`@voyantjs/catalog` now exports embedding providers, model compatibility helpers, semantic/BYO-vector search, and cross-audience federation from catalog-owned subpaths. `@voyantjs/trips` now owns the small local tool registry needed by its trips agent commands instead of depending on catalog MCP tooling.
