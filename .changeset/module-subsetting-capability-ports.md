---
"@voyant-travel/framework": minor
"@voyant-travel/hono": minor
---

Module subsetting + capability ports, Phase 1 (ADR-0007), modelled on Medusa's default-on modules. `createVoyantApp` now accepts two ways to pare the standard set:

- `exclude` — REMOVE a module a deployment doesn't run (e.g. `@voyant-travel/flights`). Excluding an `isRequired` module, or a typo'd specifier, throws.
- `overrideCapabilities` — REPLACE one: naming a capability token (e.g. `"people-directory"`) auto-displaces the standard module that provides it, so swapping Voyant CRM for HubSpot references the capability, not the module, and the two can't drift. The substitute implementation is injected through the typed `providers` container.

Both are validated against the new `FRAMEWORK_CAPABILITY_GRAPH` (now carrying `provides`/`requires`/`isRequired`): dropping a module a still-mounted module depends on — with no override — throws a named boot error listing the orphaned consumers, instead of a runtime 500. Adds the pure, reusable validators `findCapabilityGaps` + `findCapabilityProviders` (in `@voyant-travel/hono/composition`) and `subsetStandardManifest` (in `@voyant-travel/framework`). Additive and non-breaking: omitting both knobs mounts the full standard set exactly as before. Schema/migration alignment with the subset and the `PeopleDirectory` port extraction are follow-ups.
