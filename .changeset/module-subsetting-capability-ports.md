---
"@voyant-travel/framework": minor
"@voyant-travel/hono": minor
---

Module subsetting + capability ports, Phase 1 (ADR-0007). `createVoyantApp` now accepts `exclude` (standard module/extension specifiers to drop, e.g. to swap Voyant CRM for HubSpot) and `provideCapabilities` (capability tokens a deployment satisfies via an injected substitute). Exclusions are validated against the new `FRAMEWORK_CAPABILITY_GRAPH`: dropping a module a still-mounted module depends on — with no substitute — throws a named boot error listing the orphaned consumers, instead of failing as a runtime 500. Adds the pure, reusable validators `findCapabilityGaps` (in `@voyant-travel/hono/composition`) and `subsetStandardManifest` (in `@voyant-travel/framework`). Additive and non-breaking: omitting `exclude` mounts the full standard set exactly as before. Schema/migration alignment with `exclude` and the `PeopleDirectory` port extraction are follow-ups.
