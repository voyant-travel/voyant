---
"@voyantjs/catalog": minor
---

New `fetchOverlaysForEntities(db, entityModule, entityIds)` — batched form of `fetchOverlaysForEntity` that fetches active overlays for many entities of one module in a single `IN`-list query, returned as a `Map<entityId, ResolverOverlay[]>` (every requested id present; no-overlay entities map to `[]`). Pair it with the existing `resolveEntityViewWithOverlays` to resolve a whole page of entities with one overlay round trip instead of one per entity.
