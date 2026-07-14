# @voyant-travel/operator-standard

## 0.4.2

### Patch Changes

- d83d237: Repair packaged consumer development and production startup, keep shared UI
  contexts single-instanced under Vite, make unconfigured realtime quiet, and
  restore narrow client-safe validation and Finance voucher setup exports. Resolve
  legacy frontend imports through product-owned browser facades and allow clean CI
  installs to fetch metadata for external dependencies.
- Updated dependencies [d83d237]
  - @voyant-travel/admin@0.123.1
  - @voyant-travel/admin-host@0.5.1
  - @voyant-travel/bookings@0.155.2
  - @voyant-travel/finance@0.155.2
  - @voyant-travel/realtime@0.4.4
  - @voyant-travel/realtime-react@0.2.1
  - @voyant-travel/storefront@0.157.2
  - @voyant-travel/storefront-react@0.157.2
  - @voyant-travel/vite-config@0.3.2
  - @voyant-travel/admin-react@0.123.1
  - @voyant-travel/bookings-react@0.155.2
  - @voyant-travel/finance-react@0.155.2

## 0.4.1

### Patch Changes

- Updated dependencies [df3e4ec]
  - @voyant-travel/catalog@0.153.2
  - @voyant-travel/cruises@0.154.2
  - @voyant-travel/commerce@0.35.4
  - @voyant-travel/catalog-react@0.153.2
  - @voyant-travel/cruises-react@0.154.2

## 0.4.0

### Minor Changes

- 2cc954a: Make outbound webhook enqueue authority an explicit deployment provider. Standard Operator and managed-cloud deployments select `outboundWebhooks: "postgres"`; projects may instead select `"host"` with an injected `host.deliverEvent`, or `"none"` to omit graph outbound composition. `@voyant-travel/webhook-delivery` now owns provider resolution and the Postgres enqueuer adapter, while generic Runtime no longer calls the concrete Postgres enqueue function. Regenerate graphs so the provider role is present. See [Migrating to Framework 0.42](../docs/migrations/migrating-to-0.42.md#outbound-webhook-enqueue-provider).
- 07a6ee3: Make `deployment.providers.workflows` authoritative for Node workflow execution and Workflow Runs admin ownership. Self-hosted Operators now use the durable Postgres driver and receive package-owned orchestrator migrations; local mode uses the in-memory adapter, `none` omits workflow composition, and Voyant Cloud fails closed when credentials are missing.

  Scheduled one-shot dispatch disables resident scheduler and time-wheel loops and always shuts down its driver. Managed Cloud snapshots must select `voyant-cloud` before this release is deployed.

  See the [Framework 0.42 migration guide](../docs/migrations/migrating-to-0.42.md) for provider, migration, and rollout steps.

### Patch Changes

- Updated dependencies [818ea84]
- Updated dependencies [2669577]
- Updated dependencies [cc85042]
- Updated dependencies [07a6ee3]
  - @voyant-travel/workflows@0.120.0
  - @voyant-travel/vite-config@0.3.1
  - @voyant-travel/core@0.122.0
  - @voyant-travel/bookings@0.155.1
  - @voyant-travel/db@0.114.2
  - @voyant-travel/finance@0.155.1
  - @voyant-travel/inventory@0.9.3
  - @voyant-travel/legal@0.155.1
  - @voyant-travel/runtime-core@0.6.2
  - @voyant-travel/storage@0.109.3
  - @voyant-travel/workflows-orchestrator@0.120.0
  - @voyant-travel/workflow-runs@0.120.0
  - @voyant-travel/distribution@0.145.1
  - @voyant-travel/accommodations@0.115.1
  - @voyant-travel/action-ledger@0.108.3
  - @voyant-travel/auth@0.128.1
  - @voyant-travel/availability@0.2.9
  - @voyant-travel/catalog@0.153.1
  - @voyant-travel/catalog-authoring@0.107.8
  - @voyant-travel/charters@0.153.1
  - @voyant-travel/commerce@0.35.3
  - @voyant-travel/cruises@0.154.1
  - @voyant-travel/flights@0.155.1
  - @voyant-travel/identity@0.155.1
  - @voyant-travel/mcp@0.2.3
  - @voyant-travel/mice@0.11.1
  - @voyant-travel/notifications@0.126.2
  - @voyant-travel/operations@0.6.9
  - @voyant-travel/operator-settings@0.3.9
  - @voyant-travel/public-document-delivery@0.3.3
  - @voyant-travel/quotes@0.128.3
  - @voyant-travel/realtime@0.4.3
  - @voyant-travel/relationships@0.124.4
  - @voyant-travel/storefront@0.157.1
  - @voyant-travel/trips@0.146.1
  - @voyant-travel/auth-react@0.128.1
  - @voyant-travel/bookings-react@0.155.1
  - @voyant-travel/catalog-react@0.153.1
  - @voyant-travel/cruises-react@0.154.1
  - @voyant-travel/distribution-react@0.145.1
  - @voyant-travel/finance-react@0.155.1
  - @voyant-travel/flights-react@0.155.1
  - @voyant-travel/legal-react@0.155.1
  - @voyant-travel/notifications-react@0.126.2
  - @voyant-travel/storefront-react@0.157.1
  - @voyant-travel/trips-react@0.146.1

## 0.3.0

### Minor Changes

- 3f6694b: Select the customer Storefront presentation through the deployment graph. Project resolution now emits a selected presentation factory artifact, and the standard Operator emits Storefront routes only when that presentation is selected.

### Patch Changes

- Updated dependencies [4bc540f]
- Updated dependencies [bb6e890]
- Updated dependencies [3f6694b]
- Updated dependencies [37031e9]
  - @voyant-travel/auth@0.128.0
  - @voyant-travel/legal@0.155.0
  - @voyant-travel/core@0.121.0
  - @voyant-travel/storefront@0.157.0
  - @voyant-travel/workflow-runs@0.119.0
  - @voyant-travel/auth-react@0.128.0
  - @voyant-travel/legal-react@0.155.0
  - @voyant-travel/notifications@0.126.1
  - @voyant-travel/accommodations@0.115.0
  - @voyant-travel/action-ledger@0.108.2
  - @voyant-travel/availability@0.2.8
  - @voyant-travel/bookings@0.155.0
  - @voyant-travel/catalog@0.153.0
  - @voyant-travel/catalog-authoring@0.107.7
  - @voyant-travel/charters@0.153.0
  - @voyant-travel/commerce@0.35.2
  - @voyant-travel/cruises@0.154.0
  - @voyant-travel/db@0.114.1
  - @voyant-travel/distribution@0.145.0
  - @voyant-travel/finance@0.155.0
  - @voyant-travel/flights@0.155.0
  - @voyant-travel/identity@0.155.0
  - @voyant-travel/inventory@0.9.2
  - @voyant-travel/mcp@0.2.2
  - @voyant-travel/mice@0.11.0
  - @voyant-travel/operations@0.6.8
  - @voyant-travel/operator-settings@0.3.8
  - @voyant-travel/public-document-delivery@0.3.2
  - @voyant-travel/quotes@0.128.2
  - @voyant-travel/realtime@0.4.2
  - @voyant-travel/relationships@0.124.3
  - @voyant-travel/storage@0.109.2
  - @voyant-travel/trips@0.146.0
  - @voyant-travel/storefront-react@0.157.0
  - @voyant-travel/admin-app@0.47.0
  - @voyant-travel/quotes-react@0.153.0
  - @voyant-travel/bookings-react@0.155.0
  - @voyant-travel/cruises-react@0.154.0
  - @voyant-travel/inventory-react@0.37.0
  - @voyant-travel/admin-host@0.5.0
  - @voyant-travel/operator-settings-react@0.8.0
  - @voyant-travel/action-ledger-react@0.42.0
  - @voyant-travel/distribution-react@0.145.0
  - @voyant-travel/finance-react@0.155.0
  - @voyant-travel/operations-react@0.36.0
  - @voyant-travel/trips-react@0.146.0
  - @voyant-travel/catalog-react@0.153.0
  - @voyant-travel/commerce-react@0.37.0
  - @voyant-travel/flights-react@0.155.0
  - @voyant-travel/relationships-react@0.155.0
  - @voyant-travel/mice-react@0.23.0
  - @voyant-travel/notifications-react@0.126.1
  - @voyant-travel/workflows@0.119.0
  - @voyant-travel/workflows-orchestrator@0.119.0

## 0.2.3

### Patch Changes

- Updated dependencies [4d0eeed]
- Updated dependencies [bef5b7c]
- Updated dependencies [8bd906f]
- Updated dependencies [d4fa159]
  - @voyant-travel/types@0.109.0
  - @voyant-travel/utils@0.107.0
  - @voyant-travel/db@0.114.0
  - @voyant-travel/finance@0.154.0
  - @voyant-travel/legal@0.154.0
  - @voyant-travel/core@0.120.0
  - @voyant-travel/ui@0.109.0
  - @voyant-travel/notifications-react@0.126.0
  - @voyant-travel/legal-react@0.154.0
  - @voyant-travel/auth@0.127.0
  - @voyant-travel/accommodations@0.114.0
  - @voyant-travel/action-ledger@0.108.1
  - @voyant-travel/bookings@0.154.0
  - @voyant-travel/catalog@0.152.0
  - @voyant-travel/catalog-authoring@0.107.6
  - @voyant-travel/charters@0.152.0
  - @voyant-travel/commerce@0.35.1
  - @voyant-travel/cruises@0.153.0
  - @voyant-travel/distribution@0.144.0
  - @voyant-travel/flights@0.154.0
  - @voyant-travel/identity@0.154.0
  - @voyant-travel/inventory@0.9.1
  - @voyant-travel/mcp@0.2.1
  - @voyant-travel/mice@0.10.0
  - @voyant-travel/notifications@0.126.0
  - @voyant-travel/operations@0.6.7
  - @voyant-travel/operator-settings@0.3.7
  - @voyant-travel/quotes@0.128.1
  - @voyant-travel/realtime@0.4.1
  - @voyant-travel/relationships@0.124.2
  - @voyant-travel/storefront@0.156.0
  - @voyant-travel/trips@0.145.0
  - @voyant-travel/workflow-runs@0.118.0
  - @voyant-travel/admin@0.123.0
  - @voyant-travel/admin-app@0.46.0
  - @voyant-travel/admin-host@0.4.0
  - @voyant-travel/auth-react@0.127.0
  - @voyant-travel/bookings-react@0.154.0
  - @voyant-travel/commerce-react@0.36.0
  - @voyant-travel/cruises-react@0.153.0
  - @voyant-travel/distribution-react@0.144.0
  - @voyant-travel/finance-react@0.154.0
  - @voyant-travel/inventory-react@0.36.0
  - @voyant-travel/mice-react@0.22.0
  - @voyant-travel/operations-react@0.35.0
  - @voyant-travel/quotes-react@0.152.0
  - @voyant-travel/relationships-react@0.154.0
  - @voyant-travel/runtime-core@0.6.1
  - @voyant-travel/availability@0.2.7
  - @voyant-travel/public-document-delivery@0.3.1
  - @voyant-travel/storage@0.109.1
  - @voyant-travel/action-ledger-react@0.41.0
  - @voyant-travel/catalog-react@0.152.0
  - @voyant-travel/flights-react@0.154.0
  - @voyant-travel/operator-settings-react@0.7.0
  - @voyant-travel/storefront-react@0.156.0
  - @voyant-travel/trips-react@0.145.0
  - @voyant-travel/admin-react@0.123.0
  - @voyant-travel/workflows@0.118.0
  - @voyant-travel/workflows-orchestrator@0.118.0

## 0.2.2

### Patch Changes

- Updated dependencies [b29e7e8]
  - @voyant-travel/catalog@0.151.2
  - @voyant-travel/catalog-react@0.151.2

## 0.2.1

### Patch Changes

- Updated dependencies [0defbd6]
  - @voyant-travel/catalog@0.151.1
  - @voyant-travel/catalog-react@0.151.1

## 0.2.0

### Minor Changes

- c65b05c: Add the explicit standard Operator product distribution package, move standard
  selection and exact-pinned dependency ownership into it, and resolve selected
  package manifests relative to the distribution under strict pnpm installs.
- 1f6effe: Add the versioned `@voyant-travel/runtime/tooling` project build and development server API for external CLI consumers, and keep generated standard frontend routes resolvable through the selected product distribution.
- c65b05c: Generate standard Operator route registrations under `.voyant`, move public
  Finance and Quotes route behavior into package-owned contributions, and move
  standard route composition into the product distribution so application source
  contains only deployment adapters and local customization.
- c65b05c: Move the standard Operator frontend runtime, route adapters, API documentation,
  provider stack, and stylesheet bootstrap from the generic admin host into the
  standard product distribution.
- 282892e: Make `@voyant-travel/runtime` the single public Node project host, move low-level
  host primitives to `@voyant-travel/runtime-core`, and remove the package-owned
  runtime CLI. Rename remaining first-party operator-specific subpaths to generic
  runtime or runtime-support surfaces.

### Patch Changes

- c65b05c: Emit Node-compatible `.js` specifiers in the standard generated route source.
- Updated dependencies [490d132]
- Updated dependencies [047c3f9]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [047c3f9]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [c65b05c]
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
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [c65b05c]
- Updated dependencies [490d132]
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
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [047c3f9]
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
- Updated dependencies [047c3f9]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [282892e]
- Updated dependencies [490d132]
  - @voyant-travel/auth@0.126.0
  - @voyant-travel/bookings@0.153.0
  - @voyant-travel/commerce@0.35.0
  - @voyant-travel/finance@0.153.0
  - @voyant-travel/legal@0.153.0
  - @voyant-travel/storefront@0.155.0
  - @voyant-travel/action-ledger@0.108.0
  - @voyant-travel/cruises@0.152.0
  - @voyant-travel/distribution@0.143.0
  - @voyant-travel/flights@0.153.0
  - @voyant-travel/mice@0.9.0
  - @voyant-travel/notifications@0.125.0
  - @voyant-travel/realtime@0.4.0
  - @voyant-travel/relationships@0.124.1
  - @voyant-travel/storage@0.109.0
  - @voyant-travel/trips@0.144.0
  - @voyant-travel/workflow-runs@0.117.0
  - @voyant-travel/bookings-react@0.153.0
  - @voyant-travel/admin-host@0.3.0
  - @voyant-travel/auth-react@0.126.0
  - @voyant-travel/quotes@0.128.0
  - @voyant-travel/db@0.113.0
  - @voyant-travel/realtime-react@0.2.0
  - @voyant-travel/accommodations@0.113.0
  - @voyant-travel/core@0.119.0
  - @voyant-travel/inventory@0.9.0
  - @voyant-travel/catalog@0.151.0
  - @voyant-travel/mcp@0.2.0
  - @voyant-travel/admin@0.122.0
  - @voyant-travel/commerce-react@0.35.0
  - @voyant-travel/distribution-react@0.143.0
  - @voyant-travel/finance-react@0.153.0
  - @voyant-travel/flights-react@0.153.0
  - @voyant-travel/legal-react@0.153.0
  - @voyant-travel/notifications-react@0.125.0
  - @voyant-travel/operations@0.6.6
  - @voyant-travel/operations-react@0.34.0
  - @voyant-travel/relationships-react@0.153.0
  - @voyant-travel/trips-react@0.144.0
  - @voyant-travel/vite-config@0.3.0
  - @voyant-travel/quotes-react@0.151.0
  - @voyant-travel/storefront-react@0.155.0
  - @voyant-travel/catalog-react@0.151.0
  - @voyant-travel/cruises-react@0.152.0
  - @voyant-travel/inventory-react@0.35.0
  - @voyant-travel/operator-settings@0.3.6
  - @voyant-travel/admin-app@0.45.0
  - @voyant-travel/tools@0.2.0
  - @voyant-travel/operator-settings-react@0.6.0
  - @voyant-travel/public-document-delivery@0.3.0
  - @voyant-travel/charters@0.151.0
  - @voyant-travel/admin-react@0.122.0
  - @voyant-travel/framework-migrations@0.8.0
  - @voyant-travel/availability@0.2.6
  - @voyant-travel/catalog-authoring@0.107.5
  - @voyant-travel/types@0.108.1
  - @voyant-travel/runtime-core@0.6.0
  - @voyant-travel/action-ledger-react@0.40.0
  - @voyant-travel/mice-react@0.21.0
  - @voyant-travel/identity@0.153.0
  - @voyant-travel/workflows@0.117.0
  - @voyant-travel/workflows-orchestrator@0.117.0
