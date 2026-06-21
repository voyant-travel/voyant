---
"@voyant-travel/plugin-voyant-connect": minor
---

Add `resolveVoyantConnectEnv` + `prepareVoyantConnectSources` so deployments resolve Connect sources from `VOYANT_CONNECT_*` env in one call (#1976).

Both the live booking-engine registry and the discovery-sync CLI previously hand-rolled the same env mapping — API-key fallback order, operator id, market, sync limit, and the incomplete-config warning — and had already drifted (sync enumerated per-connection while the book path did not). The new helpers centralize that resolution: `prepareVoyantConnectSources(env, { enumerate })` returns the registrations directly (enumerating active connections when `enumerate` is set), so both registries share one configuration path. README documents the remaining book-path-vs-sync connection-scoping asymmetry and its async-warmed follow-up.
