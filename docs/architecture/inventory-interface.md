# Inventory Interface

Status: draft / first package-boundary slice for v1.
Audience: contributors moving operated product authoring, product-internal
components, product versions, owned inventory publication lifecycle, or future
operated-inventory subdomains.

Related:

- [Product package strategy](./product-package-strategy.md)
- [Catalog architecture](./catalog-architecture.md)
- [Schema discipline](./schema-discipline.md)
- [Frontend package strategy](../frontend-package-strategy.md)

## 1. Ownership

`inventory` is the optional operated-inventory authoring Module. It owns:

- Product structure and Product Version authoring.
- Product-internal components: options, option units, itinerary days, day
  services, media, translations, product taxonomy, and product-owned
  configuration.
- The owned inventory publication lifecycle, including publish state,
  publication timestamps, and owned-product catalog projection triggers.
- Future operated-inventory subdomains that only make sense for an operator
  managing its own sellable inventory.

`inventory` does not own:

- Catalog projection/search, overlays, provenance, snapshots, or source
  governance. Those stay in `catalog`.
- Generic quote-time commercial decisions, checkout, bookings, finance
  documents, or external counterparty identity.
- OTA/reseller default installs. A retail bundle may install `catalog` and
  `bookings` without installing Inventory authoring routes, schemas, or staff UI.

## 2. Package Shape

The target package entrypoints are:

```txt
@voyantjs/inventory
@voyantjs/inventory/schema
@voyantjs/inventory/validation
@voyantjs/inventory/routes
@voyantjs/inventory/content-shape
@voyantjs/inventory/draft-shape
@voyantjs/inventory/public-routes
@voyantjs/inventory/public-validation
@voyantjs/inventory/catalog-policy
@voyantjs/inventory/service-catalog-plane
@voyantjs/inventory/booking-engine

@voyantjs/inventory-react
@voyantjs/inventory-react/admin
@voyantjs/inventory-react/components/*
@voyantjs/inventory-react/components/product-detail
@voyantjs/inventory-react/hooks
@voyantjs/inventory-react/i18n
@voyantjs/inventory-react/styles.css
```

The first implementation slice exposes these entrypoints as Inventory-owned
compatibility facades over the existing `products` / `products-react`
implementation. New first-party code that is specifically installing operated
authoring should prefer the Inventory entrypoints. Existing
`products` / `products-react` imports remain supported until the physical table,
route, and UI file move lands.

## 3. Catalog Authoring Classification

`catalog-authoring` is split by responsibility:

- Catalog-owned: overlay editing, source governance, clone/snapshot helpers that
  operate on catalog projections or sourced content, provenance-aware validation,
  and catalog field-policy enforcement.
- Inventory-owned: operated Product and Product Version authoring,
  product-internal components, owned-product publishing, and any route or UI
  whose primary purpose is changing operated inventory truth.

Until the physical move is complete, any catalog-authoring route that mutates
operated products is a compatibility surface. Do not add new operated authoring
capabilities to `catalog-authoring`; add them to `inventory` or
`inventory-react`, with `catalog-authoring` delegating only when compatibility
requires it.

## 4. Schema Boundary

Inventory records may use normal FKs inside the Inventory package because they
share one domain lifecycle. Cross-module references must follow schema
discipline:

- Use plain id columns for references to Catalog, Bookings, Finance,
  Relationships, Distribution, Operations, or vertical/source modules.
- Export linkable definitions for template-owned associations.
- Define cross-module link tables at the template layer with `defineLink(...)`.

The first Inventory package slice does not introduce new tables or migrations.
It re-exports the existing operated product schema so generated schema manifests
remain unchanged. The physical move must either preserve generated manifest
parity or include the generated manifest/migration impact in the same PR.

## 5. Extras Boundary

Operated extras authoring/configuration is intended to follow Inventory, but
that move is gated by the extras ownership work. Until then:

- Booking add-on snapshot/provenance behavior stays with `extras` and Catalog's
  snapshot/provenance contracts.
- Inventory may reference extra ids as plain ids or template-owned links when
  preparing product-internal add-on authoring.
- Do not introduce a hard Inventory-to-Extras FK or make Catalog depend on
  Inventory to configure extras.

## 6. Compatibility

`@voyantjs/products` and `@voyantjs/products-react` remain compatibility
entrypoints for existing consumers. They should not receive new public operated
authoring surfaces once equivalent Inventory entrypoints exist.

Retail closure remains meaningful: retail-spine packages must not add hard
runtime dependencies on Inventory or its compatibility authoring packages. If a
retail-spine React package needs operated authoring UI, it must be an explicit
optional peer edge with a closure-check allowlist entry.
