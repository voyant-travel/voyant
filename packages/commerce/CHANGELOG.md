# @voyant-travel/commerce

## 0.4.0

### Patch Changes

- Updated dependencies [c9de9c4]
- Updated dependencies [14f4234]
- Updated dependencies [89d4ca9]
- Updated dependencies [85caeef]
- Updated dependencies [85a13d3]
- Updated dependencies [51dd276]
  - @voyant-travel/finance@0.122.0
  - @voyant-travel/legal@0.122.0
  - @voyant-travel/quotes@0.120.1
  - @voyant-travel/bookings@0.122.0
  - @voyant-travel/catalog@0.120.0
  - @voyant-travel/distribution@0.112.0

## 0.3.0

### Minor Changes

- 13fe70b: The commerce module now owns the catalog-checkout materialization/finalize logic: new `@voyant-travel/commerce/checkout` surface (`createCatalogCheckoutRoutes`, `startCatalogCheckout`, `materializeBookingFromSnapshot`, `dispatchCheckoutFinalize`, `rebuildBookingItemTaxLines`, etc.). Deployment specifics — tax settings, owned-product lookup, bank-transfer instructions, contract-pdf generator, and the card-payment provider start (`startCardPayment`) — are injected as options. `quotes` and `legal` are now optional peer dependencies (used only on the quote-version / contract checkout paths).

### Patch Changes

- Updated dependencies [11095db]
- Updated dependencies [13fe70b]
- Updated dependencies [13fe70b]
- Updated dependencies [9ea7220]
- Updated dependencies [503a634]
- Updated dependencies [a860e15]
  - @voyant-travel/catalog@0.119.0
  - @voyant-travel/finance@0.121.0
  - @voyant-travel/hono@0.111.0
  - @voyant-travel/legal@0.121.0
  - @voyant-travel/quotes@0.120.0
  - @voyant-travel/bookings@0.121.0
  - @voyant-travel/distribution@0.111.0
  - @voyant-travel/workflow-runs@0.109.2
  - @voyant-travel/workflows@0.109.2

## 0.2.3

### Patch Changes

- 756213e: Add public cache policy headers for cacheable public read routes and expose public response cache configuration typing.
- Updated dependencies [756213e]
  - @voyant-travel/hono@0.110.3

## 0.2.2

### Patch Changes

- @voyant-travel/hono@0.110.2
- @voyant-travel/workflows@0.109.0
- @voyant-travel/distribution@0.110.2

## 0.2.1

### Patch Changes

- 0c003f3: Make workflows node-only and remove the stale Cloudflare edge/Node step split.

  Workflow runtime annotations now accept only `runtime: "node"`, legacy
  `runtime: "edge"` is rejected, and the old split-runner wiring has been removed.
  The legacy Cloudflare workflow adapter packages, Worker reference apps, and
  standalone external step-server artifact have been removed. Managed Cloud apps
  should forward workflow calls to the hosted Node runtime, and self-hosted
  deployments should use the Node/Postgres runtime package.

- Updated dependencies [0c003f3]
  - @voyant-travel/workflows@0.108.0
  - @voyant-travel/db@0.108.1
  - @voyant-travel/hono@0.110.1
  - @voyant-travel/distribution@0.110.1

## 0.2.0

### Minor Changes

- e388bc9: Introduce the Commerce commercial decision Interface with adapter-registered
  price-availability evaluation and explicit snapshot recording.
- 6bff46f: Add Commerce runtime wiring for the pricing, markets, sellability, and
  promotions cluster. Templates can now declare one Commerce runtime entry while
  preserving the existing package route prefixes during the v1 migration.

  Allow manifest module factories in `@voyant-travel/hono/composition` to expand to
  multiple Hono modules. Remove the Promotions package's direct Storefront
  dependency by keeping the storefront offer resolver structurally typed.

- a4e0909: Move Markets, Pricing, Promotions, and Sellability runtime source behind the
  Commerce owner path. The old package names are removed from the v1 workspace
  surface, and schema/template manifests now point at Commerce directly.

### Patch Changes

- eb17d3d: Add owner-path schema manifest metadata for Commerce and Operations, expose the
  Distribution counterparty interface, and refresh operator schema/link generated
  artifacts for the v1 package restructure.
- 063f2b5: Remove Sellability's legacy construct-offer route, service method, validation
  schemas, and public `service-construct-offer` export. Commerce now keeps
  sellability focused on commercial resolution and persisted decision snapshots;
  Quote, Trips, and Booking flows own downstream materialization.
- Updated dependencies [c9ec9f8]
- Updated dependencies [6bff46f]
- Updated dependencies [081e310]
- Updated dependencies [eb17d3d]
- Updated dependencies [3e160d3]
- Updated dependencies [47fef18]
  - @voyant-travel/catalog@0.118.0
  - @voyant-travel/hono@0.110.0
  - @voyant-travel/distribution@0.110.0
  - @voyant-travel/workflows@0.107.11
