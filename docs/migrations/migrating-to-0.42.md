# Migrating Framework to 0.42

Consolidated breaking-change notes for `@voyant-travel/framework@0.42.0`.
These changes remove deprecated beta compatibility names for deployment-local
factory resources. Graph runtime providers and deployment provider selections
keep their existing names and behavior.

## TL;DR

- Rename `createVoyantApp({ providers })` to `createVoyantApp({ resources })`.
- Rename the top-level Node runtime `providers` option to `resources`.
- Replace the removed `FrameworkProviders` marker with an application-owned resource type or typed runtime ports.
- Replace `generateCustomSourcePluginManifests` with `generateCustomSourceExtensionManifests`.
- Do not rename graph manifest `providers` or `deployment.providers`; those are separate, supported concepts.

## Schema changes

None. This release does not require a database migration.

## Removed exports

| Removed | Replacement |
|---|---|
| `FrameworkProviders` | Define a type for deployment-local resources, or use package-owned typed runtime ports for package behavior. |
| `generateCustomSourcePluginManifests` | `generateCustomSourceExtensionManifests` |

## HTTP route changes

None.

## Hook signature changes

None.

## Caller-code migrations

### `createVoyantApp`

The deployment-local factory container is now named `resources`. Factories
still receive that value as their low-level Hono `capabilities` argument.

```ts
// Before: @voyant-travel/framework@0.41.x
const app = createVoyantApp({
  providers: localResources,
  modules: localModules,
  extensions: localExtensions,
  db,
})

// After: @voyant-travel/framework@0.42.x
const app = createVoyantApp({
  resources: localResources,
  modules: localModules,
  extensions: localExtensions,
  db,
})
```

### Node runtime resources

Rename only the top-level deployment-local input. Keep the nested deployment
provider selections unchanged.

```ts
// Before: @voyant-travel/framework@0.41.x
await loadVoyantNodeRuntime({
  graphRuntime,
  deployment: {
    mode: "self-hosted",
    providers: deploymentProviderSelections,
  },
  deploymentRequirements,
  providers: deploymentResources,
})

// After: @voyant-travel/framework@0.42.x
await loadVoyantNodeRuntime({
  graphRuntime,
  deployment: {
    mode: "self-hosted",
    providers: deploymentProviderSelections,
  },
  deploymentRequirements,
  resources: deploymentResources,
})
```

The same top-level rename applies when calling `createVoyantNodeApp` directly:

```ts
createVoyantNodeApp({
  applicationId,
  activeModules,
  resources: deploymentResources,
})
```

### `FrameworkProviders`

`FrameworkProviders` was an empty compatibility marker. Applications should
declare the concrete resources their local factories use:

```ts
// Before: @voyant-travel/framework@0.41.x
import type { FrameworkProviders } from "@voyant-travel/framework"

interface AppResources extends FrameworkProviders {
  customFields: CustomFieldRegistry
}

// After: @voyant-travel/framework@0.42.x
interface AppResources {
  customFields: CustomFieldRegistry
}
```

Package behavior should use package-owned typed runtime ports instead of adding
package-specific fields to the deployment-local resource container.

### Custom source extension manifests

The deprecated plugin-named alias is removed. The graph vocabulary consistently
uses `extension` for this unit kind:

```ts
// Before: @voyant-travel/framework@0.41.x
import { generateCustomSourcePluginManifests } from "@voyant-travel/framework/deployment-graph"

const extensions = generateCustomSourcePluginManifests(specifiers)

// After: @voyant-travel/framework@0.42.x
import { generateCustomSourceExtensionManifests } from "@voyant-travel/framework/deployment-graph"

const extensions = generateCustomSourceExtensionManifests(specifiers)
```

## Per-package CHANGELOGs

For full detail, including patch-level changes and dependency updates:

- [`@voyant-travel/framework@0.42.0`](../../packages/framework/CHANGELOG.md)
