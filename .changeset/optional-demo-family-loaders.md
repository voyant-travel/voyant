---
"@voyant-travel/framework": minor
---

Make demo-backed standard families optional so a deployment never has to wire (or
install a data source for) a family it doesn't run.

`FrameworkProviders.loadFlightAdminRoutes` is now **optional**. When it isn't
provided, `createVoyantApp` auto-excludes `@voyant-travel/flights` (no routes, no
admin nav) via the ADR-0007 subsetting path — "not wired" is treated as "not run"
— instead of forcing the deployment to stub it. The flights family has no
first-party real connector yet (only the demo adapter), so an operator that
doesn't sell flights should not need one.

The mechanism is a small `OPTIONAL_FAMILY_LOADERS` map (specifier → the
`FrameworkProviders` field that mounts it) plus the exported
`optionalFamiliesToExclude(providers)` helper; more families can opt in as they
gain deployment-injected, optional loaders. Deployments that DO provide the loader
(the operator starter, the managed runtime) are unaffected.
