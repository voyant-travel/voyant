---
"@voyant-travel/hono": minor
---

`createApp` is now the **config-driven front door**: it takes `{ manifest, registry, capabilities, ... }`, runs `composeFromManifest` internally, and mounts — so a deployment makes one call instead of `composeFromManifest(...)` + the old `createApp({ modules, extensions })`.

**Breaking:** the previous low-level `createApp({ modules, extensions, ... })` is renamed to **`mountApp`** (same signature). Callers that pass already-resolved `modules`/`extensions` (tests, advanced hosts) should import `mountApp`; callers that compose from a manifest should use the new `createApp`.
