---
"@voyant-travel/hono": patch
---

Fix a latent duplicate-operationId hole in `stampModuleMetadata`.

Declared operationIds were only added to the uniqueness set as the path loop
reached them, so a route hand-authoring an operationId that matched a string an
*earlier* path had already derived would leave two operations sharing that id
(breaking client generators). All route-declared ids are now pre-seeded before
any id is derived, so derived ids always yield to declared ones. No generated
spec changes today (no route declares an operationId yet) — this hardens the
non-destructive override path.
