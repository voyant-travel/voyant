# @voyant-travel/commerce

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
