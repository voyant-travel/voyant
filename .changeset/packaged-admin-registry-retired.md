---
"@voyantjs/ui": patch
"@voyantjs/core": patch
"@voyantjs/products-ui": patch
---

Packaged-admin RFC §5 deletions: the fork-and-own distribution surfaces are
retired now that all 10 admin domains ship as versioned packages. `@voyantjs/ui`
drops its shadcn registry source (`registry/`, `registry.json`, generated
`public/r/`) and the `registry:build` script — the package's published
component/export surface is unchanged and remains the only way to consume it.
`templates/dmc`, `apps/dev`, and the hosted registry worker (`apps/registry`)
are deleted from the workspace. `@voyantjs/core` and `@voyantjs/products-ui`
only see stale comment/doc references repointed from the deleted surfaces to
`templates/operator`.
