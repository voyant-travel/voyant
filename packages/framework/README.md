# @voyant-travel/framework

The Voyant framework **BOM** (bill of materials). Its `dependencies` pin the exact
tested **runtime-module set**, so a deployment tracks **one framework version** instead
of a matrix of per-package versions.

```jsonc
// a deployment's package.json
{ "dependencies": { "@voyant-travel/framework": "2.4.0" } }
```

`voyant upgrade` bumps this one version; the pinned runtime set resolves transitively.
The compatibility matrix is resolved *inside* the BOM — the deployment never sees it.

## Why a BOM and not global lockstep

Global lockstep (forcing every runtime package to the same version) requires
**republishing unchanged packages** on every release, and npm fires a publish-notification
email per package → 100+ emails per release. The BOM avoids that: the runtime packages
keep **independent versions** (only *changed* packages republish), and the BOM is the only
package that always tracks "the framework version". A one-line fix → ~3 publishes, not 100+.

## Maintenance

The dependency list is generated from the runtime-module membership
(`release.runtime-packages.generated.json`, produced by `scripts/check-lockstep-membership.mjs`):

```sh
node scripts/generate-framework-bom.mjs --emit   # regenerate deps + the exported list
node scripts/generate-framework-bom.mjs          # check (CI gate) — fails on drift
```

`workspace:*` deps publish as the **exact** current version (pnpm), so the published BOM is
deterministic.

## Exports

- `FRAMEWORK_RUNTIME_PACKAGES` — the pinned runtime-module names (e.g. for `voyant upgrade`).
- `@voyant-travel/framework/profile` — managed profile snapshots, validation,
  plugin/settings metadata, provider/resource requirements, migration metadata,
  and the `createVoyantApp` profile bridge for Cloud-managed admin/API operator
  deployments. Customer-facing site and storefront apps are separate Cloud app
  artifacts, not managed profile fields.
- `@voyant-travel/framework/deployment-graph` — v1 project/deployment graph
  declarations, resolver diagnostics, managed-profile bridging, and deterministic
  resolved graph hashing.
- `@voyant-travel/framework/deployment-artifacts` — pure lowering helpers that
  turn a resolved graph into deterministic JSON, artifact manifests, and tiny
  managed Node runtime entry modules for build/deploy tooling.
