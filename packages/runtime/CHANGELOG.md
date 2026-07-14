# @voyant-travel/runtime

## 0.9.0

### Minor Changes

- 2cc954a: Make outbound webhook enqueue authority an explicit deployment provider. Standard Operator and managed-cloud deployments select `outboundWebhooks: "postgres"`; projects may instead select `"host"` with an injected `host.deliverEvent`, or `"none"` to omit graph outbound composition. `@voyant-travel/webhook-delivery` now owns provider resolution and the Postgres enqueuer adapter, while generic Runtime no longer calls the concrete Postgres enqueue function. Regenerate graphs so the provider role is present. See [Migrating to Framework 0.42](../docs/migrations/migrating-to-0.42.md#outbound-webhook-enqueue-provider).
- 07a6ee3: Make `deployment.providers.workflows` authoritative for Node workflow execution and Workflow Runs admin ownership. Self-hosted Operators now use the durable Postgres driver and receive package-owned orchestrator migrations; local mode uses the in-memory adapter, `none` omits workflow composition, and Voyant Cloud fails closed when credentials are missing.

  Scheduled one-shot dispatch disables resident scheduler and time-wheel loops and always shuts down its driver. Managed Cloud snapshots must select `voyant-cloud` before this release is deployed.

  See the [Framework 0.42 migration guide](../docs/migrations/migrating-to-0.42.md) for provider, migration, and rollout steps.

### Patch Changes

- 2669577: Start production operator projects through their Vite-built TanStack server
  entry so virtual router imports and the React SSR singleton resolve from the
  generated server graph.
- cc85042: Make deployment provider selection authoritative for Node storage, cache, shared
  state, and rate limiting. Replace vendor-specific object-store bindings and R2
  shims with logical media/document stores, a memory provider, an AWS SDK v3
  S3-compatible provider, and package-selected custom adapters. Add a portable
  storage provider conformance runner, resolve adapters from the `storage.object`
  graph provider, and make provider config/secret/resource usage explicit. Keep
  distributed shared state and rate-limit KV authoritative by bypassing the
  cache-only process-local L1, and move guest booking lookups onto the selected
  atomic rate-limit store. Remove the former R2/SigV4 exports.
- Updated dependencies [2669577]
- Updated dependencies [2cc954a]
- Updated dependencies [cc85042]
- Updated dependencies [07a6ee3]
  - @voyant-travel/framework@0.43.0
  - @voyant-travel/vite-config@0.3.1
  - @voyant-travel/webhook-delivery@0.3.0
  - @voyant-travel/core@0.122.0
  - @voyant-travel/db@0.114.2
  - @voyant-travel/hono@0.126.2
  - @voyant-travel/runtime-core@0.6.2
  - @voyant-travel/storage@0.109.3
  - @voyant-travel/workflow-runs@0.120.0
  - @voyant-travel/auth@0.128.1

## 0.8.0

### Minor Changes

- 3f6694b: Select the customer Storefront presentation through the deployment graph. Project resolution now emits a selected presentation factory artifact, and the standard Operator emits Storefront routes only when that presentation is selected.
- 37031e9: Move Workflow Runs registry and route composition behind its selected-graph runtime port. The generic Node runtime no longer mounts Workflow Runs routes when the module is not selected.

  Direct applications can continue to instantiate `WorkflowRunnerRegistry` and call `mountWorkflowRunsAdminRoutes`. Runtime-port implementations must now expose both `register()` and `get()`.

  See the [Workflow Runs 0.119 migration guide](../docs/migrations/migrating-to-0.119.md) for the custom provider update.

### Patch Changes

- Updated dependencies [4bc540f]
- Updated dependencies [318ca57]
- Updated dependencies [3f6694b]
- Updated dependencies [37031e9]
  - @voyant-travel/auth@0.128.0
  - @voyant-travel/framework@0.42.0
  - @voyant-travel/core@0.121.0
  - @voyant-travel/workflow-runs@0.119.0
  - @voyant-travel/db@0.114.1
  - @voyant-travel/hono@0.126.1
  - @voyant-travel/webhook-delivery@0.2.2
  - @voyant-travel/admin-host@0.5.0

## 0.7.4

### Patch Changes

- Updated dependencies [4d0eeed]
- Updated dependencies [abbb9cd]
- Updated dependencies [bef5b7c]
- Updated dependencies [d4fa159]
  - @voyant-travel/hono@0.126.0
  - @voyant-travel/db@0.114.0
  - @voyant-travel/framework@0.41.0
  - @voyant-travel/core@0.120.0
  - @voyant-travel/auth@0.127.0
  - @voyant-travel/workflow-runs@0.118.0
  - @voyant-travel/admin-host@0.4.0
  - @voyant-travel/runtime-core@0.6.1
  - @voyant-travel/webhook-delivery@0.2.1

## 0.7.3

### Patch Changes

- a5d25ea: Keep project Vite configuration from redirecting the lifecycle-owned Node distribution output.

## 0.7.2

### Patch Changes

- a7d14cd: Load an optional project-root Vite configuration during both development and production builds.

## 0.7.1

### Patch Changes

- 0ddd848: Build every Vite application environment for clean projects so `voyant build`
  emits both the client assets and the TanStack Start Node server.

## 0.7.0

### Minor Changes

- c65b05c: Move the complete graph-native Node application host into runtime,
  including generated graph admission, local and managed auth, API/admin serving,
  workflow services and schedules, outbound delivery, links, and runtime ports.
  Move the generic Postgres webhook enqueue boundary out of Distribution and into
  the neutral webhook-delivery package.
- 1f6effe: Add the versioned `@voyant-travel/runtime/tooling` project build and development server API for external CLI consumers, and keep generated standard frontend routes resolvable through the selected product distribution.
- 490d132: Add the graph-native generic Node runtime API and boot generated project and
  deployment artifacts without constructing or reading a managed-profile
  compatibility snapshot.
- 047c3f9: Release the generic Node operator host and minimal project authoring surface, with standard product
  BOM expansion, convention-driven project runtime adapters, and an independently bootable starter.
- 490d132: Boot packaged Operator projects with the statically selected package runtime contributors and reusable generic Node host primitives instead of fail-on-use runtime port stubs.
- 282892e: Make `@voyant-travel/runtime` the single public Node project host, move low-level
  host primitives to `@voyant-travel/runtime-core`, and remove the package-owned
  runtime CLI. Rename remaining first-party operator-specific subpaths to generic
  runtime or runtime-support surfaces.

### Patch Changes

- c65b05c: Generate standard Operator TypeScript, environment, Vite, and Vitest metadata beneath `.voyant` instead of shipping copied starter configuration.
- c65b05c: Move generic selected-graph OpenAPI host assembly out of the Operator starter and into the Node runtime package.
- cda53b6: Preserve legacy migration and route behavior in the unified Node host, align generated admin assets with their graph artifacts, restore auth email and media compatibility, and publish the selected-graph OpenAPI entry.
- c65b05c: Validate required auth secrets at the Operator auth boundary, adapt the generic
  Node host contracts to auth, webhook, and scheduled workflow runtimes, and
  exclude test sources from the published package build.
- c65b05c: Own generic Operator deployment-resource composition in the runtime package so projects inject only concrete Node primitives and generated graph ports.
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [047c3f9]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [047c3f9]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [cda53b6]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [047c3f9]
- Updated dependencies [490d132]
- Updated dependencies [282892e]
  - @voyant-travel/auth@0.126.0
  - @voyant-travel/framework@0.40.0
  - @voyant-travel/workflow-runs@0.117.0
  - @voyant-travel/admin-host@0.3.0
  - @voyant-travel/db@0.113.0
  - @voyant-travel/core@0.119.0
  - @voyant-travel/webhook-delivery@0.2.0
  - @voyant-travel/vite-config@0.3.0
  - @voyant-travel/hono@0.125.1
  - @voyant-travel/runtime-core@0.6.0
