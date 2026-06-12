---
"@voyantjs/core": minor
---

`queryGraph` resolves each relation with ONE batched link lookup instead of one `LinkService.list` call per base record — listing 50 products with `category.*` previously fired 50 link-table queries (each a subrequest + roundtrip on Workers + neon-http); it now fires 1. Attach semantics are unchanged: list sides still attach as arrays, non-list sides as object-or-null, target IDs are deduped before hydration, and per-base target order is preserved (rows arrive in the link service's `created_at ASC` order and are grouped locally). To support this, the `LinkService` interface's `list` filter is now the new exported `LinkListFilter` type, which adds optional `leftIds`/`rightIds` arrays (matched as one batched query) next to the existing singular fields — existing implementations remain assignable, but custom `LinkService` implementations and test mocks must handle the plural fields to be queried by `queryGraph`.
