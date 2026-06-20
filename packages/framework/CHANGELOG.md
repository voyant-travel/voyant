# @voyant-travel/framework

## 0.2.6

### Patch Changes

- Updated dependencies [1841ce2]
- Updated dependencies [4893352]
  - @voyant-travel/relationships@0.120.4
  - @voyant-travel/quotes@0.122.2
  - @voyant-travel/identity@0.126.1
  - @voyant-travel/distribution@0.116.1
  - @voyant-travel/inventory@0.3.7
  - @voyant-travel/commerce@0.8.1
  - @voyant-travel/catalog@0.124.1
  - @voyant-travel/finance@0.126.1
  - @voyant-travel/notifications@0.114.2
  - @voyant-travel/legal@0.126.1
  - @voyant-travel/storefront@0.127.1
  - @voyant-travel/operator-settings@0.2.5
  - @voyant-travel/action-ledger@0.105.3
  - @voyant-travel/trips@0.117.1
  - @voyant-travel/operations@0.1.7

## 0.2.5

### Patch Changes

- Updated dependencies [84b9d4b]
  - @voyant-travel/legal@0.126.0
  - @voyant-travel/commerce@0.8.0
  - @voyant-travel/notifications@0.114.1
  - @voyant-travel/storefront@0.127.0
  - @voyant-travel/inventory@0.3.6
  - @voyant-travel/bookings@0.126.0
  - @voyant-travel/catalog@0.124.0
  - @voyant-travel/distribution@0.116.0
  - @voyant-travel/finance@0.126.0
  - @voyant-travel/flights@0.126.0
  - @voyant-travel/identity@0.126.0
  - @voyant-travel/trips@0.117.0
  - @voyant-travel/operations@0.1.6
  - @voyant-travel/operator-settings@0.2.4
  - @voyant-travel/relationships@0.120.3
  - @voyant-travel/quotes@0.122.1

## 0.2.4

### Patch Changes

- Updated dependencies [e89640b]
  - @voyant-travel/operator-settings@0.2.3
  - @voyant-travel/action-ledger@0.105.2
  - @voyant-travel/trips@0.116.1

## 0.2.3

### Patch Changes

- @voyant-travel/catalog@0.123.1

## 0.2.2

### Patch Changes

- Updated dependencies [a74471e]
  - @voyant-travel/quotes@0.122.0
  - @voyant-travel/commerce@0.7.0
  - @voyant-travel/inventory@0.3.5
  - @voyant-travel/storefront@0.126.0
  - @voyant-travel/bookings@0.125.0
  - @voyant-travel/catalog@0.123.0
  - @voyant-travel/distribution@0.115.0
  - @voyant-travel/finance@0.125.0
  - @voyant-travel/flights@0.125.0
  - @voyant-travel/identity@0.125.0
  - @voyant-travel/legal@0.125.0
  - @voyant-travel/notifications@0.114.0
  - @voyant-travel/trips@0.116.0
  - @voyant-travel/operations@0.1.5
  - @voyant-travel/operator-settings@0.2.2
  - @voyant-travel/relationships@0.120.2
  - @voyant-travel/hono@0.112.2

## 0.2.1

### Patch Changes

- @voyant-travel/hono@0.112.1
- @voyant-travel/bookings@0.124.0
- @voyant-travel/catalog@0.122.0
- @voyant-travel/distribution@0.114.0
- @voyant-travel/finance@0.124.0
- @voyant-travel/flights@0.124.0
- @voyant-travel/identity@0.124.0
- @voyant-travel/legal@0.124.0
- @voyant-travel/notifications@0.113.0
- @voyant-travel/storefront@0.125.0
- @voyant-travel/trips@0.115.0
- @voyant-travel/commerce@0.6.0
- @voyant-travel/inventory@0.3.4
- @voyant-travel/operations@0.1.4
- @voyant-travel/operator-settings@0.2.1
- @voyant-travel/relationships@0.120.1
- @voyant-travel/quotes@0.121.1

## 0.2.0

### Minor Changes

- 04681f3: Adopt custom fields on `booking` — the first entity consumer of the `@voyant-travel/core/custom-fields` registry.

  - A `custom_fields jsonb default '{}'` column on `bookings` (framework bundle migration `0001`).
  - Booking create/update routes validate the `customFields` payload at the boundary against the deployment's injected registry (`validateBookingCustomFields`): unknown keys, missing required, and wrong types are rejected 400; only registry-approved values are persisted. Writes that carry `customFields` when the deployment declares none are rejected.
  - The registry is injected through `BookingRouteRuntimeOptions.customFields` → `createBookingsHonoModule` → a new optional `FrameworkProviders.customFields` provider, which a deployment supplies (the operator wires its discovered `operatorCustomFields`).

  Read paths return `custom_fields` as part of the booking row. Oracle-verified (`bundle + links == live schema`). Per-entity adoption continues with `person`/`product`; export/invoice/search consumption of `customFieldsVisibleIn` is a follow-up. See `docs/architecture/custom-fields.md`.

- 9c3fe53: Custom-fields unification (phase 2 — person/organization adopt the `custom_fields` column). Both `people` and `organizations` gain a `custom_fields jsonb default '{}'` column (framework bundle migration `0002`), and their create/update routes validate `customFields` at the write boundary against the resolved registry (code ∪ runtime `custom_field_definitions`):

  - `relationships`: `RelationshipsRouteRuntime(+Options).customFields` resolver; a `validateRelationshipsCustomFields(c, entity, data)` helper on the accounts route (its `Env` now exposes `container`); person/org writes persist the cleaned value.
  - `relationships-contracts`: `customFields` added to the person/organization core schemas.
  - `framework`: the relationships factory moves Tier 1 → 2 to receive `capabilities.customFields`.

  Values now live on the entity row for `booking`, `person`, and `organization`. Still ahead: repoint the EAV value API to the column + backfill `custom_field_values` → jsonb, then retire the side table. Oracle-verified (bundle + links == live schema).

- 3d0c070: New `@voyant-travel/framework` BOM (bill of materials) package. Its `dependencies` pin the tested runtime-module set (the 16 mounted modules), so a deployment tracks **one framework version** and upgrades atomically — no per-package compatibility matrix. Deliberately not global lockstep: runtime packages keep independent versions (only changed ones republish, avoiding the per-package npm email spam), and the BOM is the single package that tracks the framework version. The dep list is generated from the membership manifest (`scripts/generate-framework-bom.mjs`), gated in CI via `verify:framework-bom`. Exports `FRAMEWORK_RUNTIME_PACKAGES` for `voyant upgrade`.
- d222e9f: **Convergence (Workstream B step 3):** `@voyant-travel/framework` now exports `createVoyantApp({ providers, modules?, extensions?, …config })` — the config-driven front door. It assembles the framework-owned standard set (`FRAMEWORK_RUNTIME_MANIFEST` + `frameworkComposition`) with the deployment's injected providers and any deployment-local module/extension additions, then delegates to `@voyant-travel/hono`'s lower-level `createApp`.

  A standard deployment's `app.ts` collapses to a single `createVoyantApp({ providers: buildOperatorProviders(), modules: deploymentLocalModules, …db/workflows/outbox/publicPaths })` call — no hand-maintained manifest or registry. The operator starter is converged: `buildOperatorCapabilities → buildOperatorProviders`, the two deployment-local module factories are extracted to `deploymentLocalModules`, and `OPERATOR_RUNTIME_MANIFEST` / `operatorComposition` remain only as derived exports for `voyant db doctor` parity + the composition tests.

  (hono: docstring on `createApp` updated to point standard deployments at `createVoyantApp`.)

- c96beb8: Add `modulesFromGlob` + `defineDeploymentModule` — the runtime half of the "build your own module without forking" seam. A deployment feeds a Vite `import.meta.glob("../modules/*/index.ts", { eager: true })` (compiled to static imports at build time — Workers-safe) into `modulesFromGlob`, which keys each custom module by its `<name>` directory and normalizes its default export (a `HonoModule` or `ModuleFactory`, via `defineDeploymentModule`) into the composition registry.

  Pairs with the deployment drizzle config glob (`src/modules/*/schema.ts`) so a custom module's tables are migrated as a deployment source after the framework bundle. See `docs/architecture/custom-modules.md`.

- 7cff632: Add `extensionsFromGlob` + `defineDeploymentExtension` — the extension counterpart to `modulesFromGlob`/`defineDeploymentModule`. A deployment drops a `HonoExtension` into `src/extensions/<name>/index.ts` (custom routes on an _existing_ module, e.g. `/v1/admin/bookings/notes`) and it is auto-discovered and mounted via `import.meta.glob`, keyed by directory name. Pairs with the deployment drizzle config glob (`src/extensions/*/schema.ts`) so an extension that owns tables is migrated as a deployment source after the framework bundle.

  Completes the "build your own routes/modules without forking" seam (custom module + custom extension). See `docs/architecture/custom-modules.md`.

- 0f65f95: `FRAMEWORK_RUNTIME_MANIFEST` now owns the `operator/*` **standard** family entries (the 6 lazy modules — mcp, catalog-booking, catalog-content, media, payment-link, contract-document — and all 7 lazy extensions), matching the `frameworkComposition` registry that already owns their factories.

  The deployment's `OPERATOR_RUNTIME_MANIFEST` collapses to `[...FRAMEWORK_RUNTIME_MANIFEST.modules, "operator/invitations", "operator/operator-settings"]` for modules and `[...FRAMEWORK_RUNTIME_MANIFEST.extensions]` for extensions — i.e. it appends only the two genuinely deployment-local module families and zero deployment-local extensions.

  Composed module/extension counts are unchanged (29 / 15). The relative mount order of the standard families is preserved; only `invitations` + `operator-settings` (disjoint absolute-path lazy families) move to the end of the module list, which is mount-order-immaterial. This is the manifest-ownership prerequisite for the `createApp({ config, providers, extensions })` convergence.

- 74574cd: `@voyant-travel/framework` now owns the standard runtime composition manifest (`FRAMEWORK_RUNTIME_MANIFEST` — the ordered 21 package modules + 8 package extensions). The operator deployment spreads it and appends only its deployment-local `operator/*` families, so adding a standard module to the framework auto-joins the default set without the deployment re-listing it. First slice of Workstream B (the standard composition relocation); the registry factories relocate next.
- cfa613b: The framework now owns the **standard runtime composition registry**, not just the BOM + manifest. New exports:

  - `frameworkComposition` — a `CompositionRegistry` of the package-owned standard factories a deployment spreads into its own registry (`{ ...frameworkComposition.modules }`), so `composeFromManifest` sees one complete registry while the deployment shrinks.
  - `FrameworkProviders` — the typed, injected provider surface the standard factories read off `ctx.capabilities` (the deployment's capability container is a structural superset).

  This first slice (Workstream B, Tier 1) relocates the pure singleton module factories — action-ledger, relationships, quotes, operations, identity, distribution, commerce, inventory — which take no providers. Capability-shaped factories and the lazy `operator/*` route loaders follow in later tiers.

- ec8018f: Relocate the first capability-shaped standard module factories into `frameworkComposition` (Workstream B, Tier 2a): **bookings, storefront/customer-portal, storefront/verification, trips**. These read injected providers off `ctx.capabilities` rather than being hand-wired in the deployment.

  `FrameworkProviders` gains its first real fields — `relationshipsService`, `closePaymentSchedulesForBooking`, `resolveDocumentDownloadUrl`, `resolveNotificationProviders`, `createTripsRoutesOptions` — each typed by the package option type it feeds (`NonNullable<XOptions["field"]>`) or by a package service (`typeof relationshipsService`), so the provider contract can't drift from what the factories pass it into. A deployment's capability container now structurally `extends FrameworkProviders`.

  `public-document-delivery` is intentionally deferred: its storage provider takes the deployment's narrow `CloudflareBindings`, which surfaces a bindings-variance design question for the provider contract — to be resolved with the storage/document group rather than papered over.

- c31e566: Relocate the **catalog** and **storefront** module factories into `frameworkComposition` (Workstream B, Tier 2b). `FrameworkProviders` gains:

  - `resolveCatalogRuntime` — typed `CatalogSearchRoutesOptions["resolveRuntime"]`. The deployment adapts its `buildCatalogContext` (a Hono-`Context` → catalog runtime mapping) into this shape, so the framework factory consumes the package's runtime contract directly.
  - `storefrontIntakePersistence` — the exported `StorefrontIntakePersistence`, built from the deployment's relationships-backed intake runtime.

  The framework's storefront factory builds its commerce offer resolvers from the package (`createCommerceStorefrontOfferResolvers`); only the deployment-specific intake persistence + `resolveDb` are injected.

- 529f340: Relocate the **public-document-delivery** and **notifications** module factories into `frameworkComposition` (Workstream B, Tier 2b). `FrameworkProviders` gains `resolvePublicCheckoutBaseUrl` and `readDocumentContentBase64` (notifications); public-document-delivery reuses the `createOperatorDocumentStorage` provider added with legal.

  This resolves the public-document-delivery deferral from Tier 2a: routing its `resolveStorage` through the uniform `unknown`-bindings `createOperatorDocumentStorage` adapter (rather than the narrow-`CloudflareBindings` `createDocumentStorage`) keeps the provider contract uniform and lets the deployment retire `createDocumentStorage` entirely.

- e5ce077: Relocate the **inventory/extras** and **bookings/requirements** module factories into `frameworkComposition` (Workstream B, Tier 2b).

  - `inventory/extras` — the combined inventory+bookings extras surface (`new Hono().route(inventoryExtrasRoutes).route(bookingsExtrasRoutes)`) is now built in the framework. This adds `hono` as a **dev + peer** dependency (the framework's first plain-`hono` value usage; kept out of the BOM-locked `dependencies`).
  - `bookings/requirements` — `FrameworkProviders` gains `resolveBookingRequirementsProductSnapshot`, typed via `BookingRequirementsHonoModuleOptions` indexed access.

- 9dc4aa0: Relocate the **finance** module factory into `frameworkComposition` (Workstream B, Tier 2b — completes Tier 2). This is the last and largest capability-shaped module: its notifications→checkout adapter helpers (`toCheckoutNotificationDelivery`, `toCheckoutReminderRun`, `optionalDateTime` + the `NotificationDeliveryLike`/`NotificationReminderRunLike` types) move into the framework alongside the factory.

  `FrameworkProviders` gains `createInvoiceExchangeRateResolver`, `createInvoiceSettlementPollers`, `resolveBankTransferDetails` (typed via `FinanceHonoModuleOptions` indexed access) and `netopiaCheckoutStarter` (`CheckoutPaymentStarter` — Netopia stays injected, never imported by the framework). Finance also reuses the already-relocated `resolveDocumentDownloadUrl`, `resolvePublicCheckoutBaseUrl`, and `resolveNotificationProviders` providers, confirming those shared fields satisfy multiple package option contracts.

  With finance done, all 21 standard `@voyant-travel/*` modules are framework-owned; only the standard extensions (Tier 3) and the `operator/*` lazy families (Tier 4) remain in the deployment registry.

- ba387e0: Relocate the **legal** module factory into `frameworkComposition` (Workstream B, Tier 2b). `FrameworkProviders` gains the legal provider fields — `resolveDb`, `createOperatorDocumentStorage`, `resolveContractDocumentGenerator`, `createBookingPiiService`, `autoGenerateContractOnConfirmed` — each typed by `CreateLegalHonoModuleOptions` indexed access (drift-proof). All are `unknown`/`Record<string,unknown>`-bindings adapters, so the `OperatorCapabilities extends FrameworkProviders` guard passes cleanly.
- 54fc04a: Relocate the 6 pure singleton standard **extensions** into `frameworkComposition.extensions` (Workstream B, Tier 3a): bookings/booking-supplier, finance/bookings-create, inventory/booking, inventory/authoring, quotes/booking, and distribution (booking) extensions. These take no providers, so they move like the Tier 1 singletons; the deployment now spreads `...frameworkComposition.extensions`. The two injection-shaped extensions (distribution/channel-push, finance/booking-tax) remain in the deployment for Tier 3b.
- 4e5bb43: Relocate the 2 injection-shaped standard extensions into `frameworkComposition.extensions` (Workstream B, Tier 3b — completes Tier 3):

  - **finance/booking-tax** — `createBookingTaxHonoExtension` now lives in the framework factory; `FrameworkProviders` gains `resolveBookingTaxSettings` + `updateBookingTaxSettings` (typed via `BookingTaxRouteOptions`).
  - **distribution/channel-push** — its builder is genuinely deployment-wired (booking-engine registry), so it's injected as a `createChannelPushExtension: () => HonoExtension` provider; the framework owns the manifest entry while the deployment supplies the builder. This previews the Tier 4 injected-builder pattern.

  All standard `@voyant-travel/*` extensions are now framework-owned.

- a9fd30a: Relocate the 7 lazy `operator/*` standard module factories into `frameworkComposition.modules` (Workstream B, Tier 4a): flights, mcp, catalog-booking, catalog-content, media, payment-link, contract-document.

  The framework now owns each family's manifest entry **and its stable absolute route-path matchers** (the URL contract); the deployment injects only the `load` closure that wires its providers into the package-owned route bundle. `FrameworkProviders` gains 7 `LazyRoutesLoader` fields (`loadFlightAdminRoutes`, `loadMcpAdminRoutes`, `loadCatalogBookingRoutes`, `loadCatalogContentRoutes`, `loadMediaRoutes`, `loadPaymentLinkRoutes`, `loadContractDocumentRoutes`). `OPERATOR_RUNTIME_MANIFEST` is unchanged, preserving exact mount order. Only `operator/invitations` and `operator/operator-settings` remain in the deployment registry.

- 29086c7: Relocate the 7 lazy `operator/*` standard extension factories into `frameworkComposition.extensions` (Workstream B, Tier 4b — completes Tier 4): booking-schedule, quote-version-snapshot, booking-maintenance, action-ledger-health, proposal, catalog-offers, catalog-checkout.

  The framework owns each extension's `{ name, module }` metadata + `publicPath`; the deployment injects the builders/loaders. `FrameworkProviders` gains 8 fields — 2 `() => HonoExtension` builders (`createBookingScheduleExtension`, `createQuoteVersionSnapshotExtension`) and 6 `LazyRoutesLoader`s (`loadBookingMaintenanceRoutes`, `loadActionLedgerHealthRoutes`, `loadProposalAdminRoutes`, `loadProposalPublicRoutes`, `loadCatalogOffersRoutes`, `loadCatalogCheckoutRoutes`).

  The deployment's `operatorComposition.extensions` is now just `{ ...frameworkComposition.extensions }`. All standard modules **and** extensions are framework-owned; only `operator/invitations` + `operator/operator-settings` remain as deployment-local module factories (→ `extensions[]` at convergence).

- d45dd31: Collapse the booking-tax reader injection (Workstream B step 4, Stage 2a). The framework's `finance/booking-tax-extension` factory now reads `resolveBookingTaxSettings` / `updateBookingTaxSettings` straight from the standard `@voyant-travel/operator-settings` package instead of from injected providers.

  `FrameworkProviders` drops `resolveBookingTaxSettings` + `updateBookingTaxSettings`, and the operator deployment stops wiring them in `buildOperatorProviders`. This is the decided framework-layer wiring (open-question 2): no leaf module depends on operator-settings — only the framework assembly layer does (added as a dev + peer dependency, kept out of the BOM-locked `dependencies`). operator-settings stays `additionalSchemas`-only, so the runtime/BOM lockstep set is unchanged (16).

- cc82783: Promote `@voyant-travel/operator-settings` to a standard mounted module (Workstream B step 4, Stage 2b — completes the extraction).

  - The package gains a HonoModule: `./hono-module` (`createOperatorSettingsHonoModule()`, lazyRoutes at the stable absolute paths `/v1/admin/settings/*`, `/v1/public/operator-profile`, `/v1/public/settings/operator`) + `./routes` (the handlers). New deps: `@voyant-travel/hono` + `hono`.
  - It moves from `voyant.config` `additionalSchemas` → `modules`, so it joins the runtime/BOM **lockstep set (16 → 17)** and is added to the framework BOM `dependencies`. `FRAMEWORK_RUNTIME_MANIFEST` + `frameworkComposition` own its factory.
  - The deployment drops `operator/operator-settings` from `deploymentLocalModules` (now only `invitations` remains) and **deletes** `src/api/routes/settings.ts` — the settings routes are package-owned.

  Migration parity holds (schema byte-identical, already in snapshot 0067; `additionalSchemas`→`modules` only changes the schema's position in the drizzle list, not its DDL). Composed module/extension counts are unchanged (29 / 34 / 15) — the module just moved framework-owned. `check-public-cache-policy` updated to the package's new routes path.

### Patch Changes

- Updated dependencies [04681f3]
- Updated dependencies [a3bd51c]
- Updated dependencies [170388e]
- Updated dependencies [e9d9dbb]
- Updated dependencies [9c3fe53]
- Updated dependencies [d29dd47]
- Updated dependencies [ce2a568]
- Updated dependencies [3aa90b4]
- Updated dependencies [39d48fe]
- Updated dependencies [9616f1f]
- Updated dependencies [d222e9f]
- Updated dependencies [6d75244]
- Updated dependencies [cc82783]
  - @voyant-travel/bookings@0.123.0
  - @voyant-travel/hono@0.112.0
  - @voyant-travel/relationships@0.120.0
  - @voyant-travel/finance@0.123.0
  - @voyant-travel/quotes@0.121.0
  - @voyant-travel/operator-settings@0.2.0
  - @voyant-travel/commerce@0.5.0
  - @voyant-travel/distribution@0.113.0
  - @voyant-travel/legal@0.123.0
  - @voyant-travel/notifications@0.112.0
  - @voyant-travel/storefront@0.124.0
  - @voyant-travel/trips@0.114.0
  - @voyant-travel/action-ledger@0.105.1
  - @voyant-travel/catalog@0.121.0
  - @voyant-travel/identity@0.123.0
  - @voyant-travel/inventory@0.3.3
  - @voyant-travel/operations@0.1.3
  - @voyant-travel/flights@0.123.0
