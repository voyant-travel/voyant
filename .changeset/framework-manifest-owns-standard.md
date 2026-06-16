---
"@voyant-travel/framework": minor
---

`FRAMEWORK_RUNTIME_MANIFEST` now owns the `operator/*` **standard** family entries (the 6 lazy modules — mcp, catalog-booking, catalog-content, media, payment-link, contract-document — and all 7 lazy extensions), matching the `frameworkComposition` registry that already owns their factories.

The deployment's `OPERATOR_RUNTIME_MANIFEST` collapses to `[...FRAMEWORK_RUNTIME_MANIFEST.modules, "operator/invitations", "operator/operator-settings"]` for modules and `[...FRAMEWORK_RUNTIME_MANIFEST.extensions]` for extensions — i.e. it appends only the two genuinely deployment-local module families and zero deployment-local extensions.

Composed module/extension counts are unchanged (29 / 15). The relative mount order of the standard families is preserved; only `invitations` + `operator-settings` (disjoint absolute-path lazy families) move to the end of the module list, which is mount-order-immaterial. This is the manifest-ownership prerequisite for the `createApp({ config, providers, extensions })` convergence.
