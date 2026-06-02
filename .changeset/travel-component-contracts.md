---
"@voyantjs/travel-components-contracts": minor
"@voyantjs/catalog-contracts": minor
"@voyantjs/products-contracts": minor
"@voyantjs/catalog": patch
"@voyantjs/products": patch
"@voyantjs/catalog-ui": patch
"@voyantjs/products-react": patch
"@voyantjs/pricing": patch
"@voyantjs/pricing-react": patch
"@voyantjs/travel-composer": patch
---

Add shared travel component content contracts and wire them into `products/v1`.

- `@voyantjs/travel-components-contracts`: new zod-only contract package for
  board basis, component refs, component kind/selection/commitment/price
  disposition enums, accommodation component content, transport component
  content, generic component content, component choice pricing refs, and
  `travelComponentSchema`.
- `@voyantjs/catalog-contracts` / `@voyantjs/catalog`: booking-engine V1 now
  supports `component-choice` configure descriptors and
  `draft.configure.componentSelections`, allowing component choices to map onto
  existing product option/unit pricing identifiers.
- `@voyantjs/products-contracts`: `productContentSchema` now includes a
  defaulted `components` block backed by the shared travel component schemas, so
  package-style product content can carry structured accommodation, transport,
  activity, meal, insurance, or other components without flattening them into
  copy. Public/catalog/content contracts also expose a `sellableKind` /
  `sellable_kind` facet for package-like sellables. Component import payloads
  are validated through `importProductComponentsSchema`.
- `@voyantjs/products`: synthesized sourced product content now initializes the
  new `components` block to an empty array, and the runtime content-shape
  export re-exports the `ProductComponent` type. Product catalog projection,
  public hydration, search documents, and owned content now infer the
  lightweight `sellableKind` facet without adding a products table
  discriminator. Operated product components are persisted in
  `product_components`, exposed through service/routes, projected into owned
  content, can be bulk-imported with dry-run append/replace modes, and can feed
  booking component-choice descriptors that reuse existing pricing option/unit
  IDs.
- `@voyantjs/catalog-ui`: catalog detail enrichment now maps product
  `components` and renders them in a Components tab when present.
- `@voyantjs/products-react`: component query and mutation hooks expose the new
  product component routes to authoring surfaces, including choice pricing-ref
  maintenance and typed JSON component imports.
- `@voyantjs/pricing` / `@voyantjs/pricing-react`: add a typed rate-plan matrix
  import endpoint and React mutation hook that dry-run or upsert existing
  schedules, pricing categories, option rules, unit rules, and departure
  overrides without introducing a parallel package-pricing model.
- `@voyantjs/travel-composer`: expose
  `projectIndependentCatalogComponents(...)` to turn selected
  `independent_component` travel components into catalog-backed trip component
  inputs with `bookingDraftV1` metadata for the existing quote/reserve path.
