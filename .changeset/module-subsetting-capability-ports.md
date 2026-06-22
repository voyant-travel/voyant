---
"@voyant-travel/framework": minor
"@voyant-travel/hono": minor
---

Module subsetting, Phase 1 (ADR-0007). The standard set is default-on; `createVoyantApp` now accepts `exclude` — a list of standard module/extension specifiers to REMOVE from the framework set, for a deployment that doesn't run them (e.g. `@voyant-travel/flights`).

Excludes are validated against the new `FRAMEWORK_CAPABILITY_GRAPH` (declaring `provides`/`requires`/`isRequired`): excluding a module another mounted module depends on, an `isRequired` foundational module, or a specifier not in the standard set throws a named boot error listing what's wrong — never a runtime 500. Adds the pure validators `findCapabilityGaps` (`@voyant-travel/hono/composition`) and `subsetStandardManifest` (`@voyant-travel/framework`).

Additive and non-breaking: omitting `exclude` mounts the full standard set exactly as before.

Capability *replacement* (swap Voyant CRM for HubSpot via override-by-capability + injected ports) is the documented v2 design and intentionally not wired yet — the `PeopleDirectory` port doesn't exist, so a replace knob would silently mis-resolve. Removal works today; replacement, schema-side subsetting, and the port extraction are tracked follow-ups.
