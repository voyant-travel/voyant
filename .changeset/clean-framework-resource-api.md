---
"@voyant-travel/framework": minor
---

Rename deployment-local `createVoyantApp` factory inputs from `providers` to `resources`, remove the deprecated Node runtime `providers` aliases, and remove the retired `FrameworkProviders` and `generateCustomSourcePluginManifests` exports. Graph runtime providers and deployment provider selections are unchanged. See [Migrating to Framework 0.42](../../docs/migrations/migrating-to-0.42.md) for caller rewrites.
