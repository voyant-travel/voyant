---
"@voyant-travel/framework": minor
---

Module subsetting: cascade standard-extension exclusion from declared ownership
(voyant#2104, ADR-0007 follow-up a).

Excluding a standard module now drops the extensions it owns in the **core**
`subsetStandardManifest` primitive, not only in the managed-profile wrapper.
Previously a direct `createVoyantApp({ exclude })` caller (self-host, tooling,
tests) could drop a module while an augmenting extension stayed mounted on the
now-absent surface — e.g. removing `bookings` while
`@voyant-travel/finance/bookings-create-extension` (mounting under
`/v1/admin/bookings`) leaked.

- `FRAMEWORK_EXTENSION_OWNERSHIP` — declares which standard module(s) each
  standard extension augments, co-located with `FRAMEWORK_RUNTIME_MANIFEST` /
  `FRAMEWORK_CAPABILITY_GRAPH` and typed against them so it cannot drift. An
  extension's mount prefix is a path, not a foreign key to a module `name`, so
  path-mounted extensions with no same-named module (e.g.
  `operator/proposal-extension` under `quote-versions`) cascade by declaration
  rather than an unsound name-match.
- `ownedExtensionsForExcludedModules(excluded)` — the shared, exported cascade
  helper. `subsetStandardManifest` and the managed-profile exclude computation
  now use the single source of truth (the hand-maintained ownership map
  previously duplicated in `profile.ts` is removed).

Schema stays whole: subsetting gates runtime + admin surfaces only; the standard
migration bundle is unchanged (an unselected module's tables are migrated but
inert). This keeps the fixed-operator and subset paths on the same single-bundle
managed-migration model.
