# @voyant-travel/openapi

## 0.2.2

### Patch Changes

- ce0f92d: Regenerate framework OpenAPI specs to match current quote route response schemas.

## 0.2.1

### Patch Changes

- eb9285a: Prevent partial pricing update schemas from reapplying insert defaults to omitted fields.

## 0.2.0

### Minor Changes

- eda3465: Republish the framework OpenAPI spec with the backfilled public surface (voyant#2114).

  The generated `framework-storefront` document now covers the full storefront public
  surface — products/taxonomy/pricing, promotional offers, lead + newsletter intake,
  email/SMS verification, and the customer portal (profile, companions, documents,
  bookings) — plus the bookings public routes, all generated from the composed app
  and drift-gated. Consumers (e.g. Voyant Cloud) that depend on this artifact now
  receive the complete framework-standard surface instead of only the initial
  inventory/pricing routes from 0.1.0.

  Operator-local route families (cruises, charters) are documented in the operator
  deployment spec, not this framework artifact, by design.

## 0.1.0

### Minor Changes

- 7c5ee80: New package: the generated OpenAPI 3.1 spec for the Voyant framework's standard
  API surface (voyant#2114).

  Ships JSON only (no runtime deps): `@voyant-travel/openapi` (full),
  `@voyant-travel/openapi/admin` (`/v1/admin/*`), `@voyant-travel/openapi/storefront`
  (`/v1/public/*`). The spec is generated from the framework's standard module
  composition — the union of each module's `.openapi()` contracts — so it's the
  portable framework contract, not any single deployment's surface. A drift gate
  keeps the committed artifacts in sync with the handlers; refresh with
  `pnpm --filter @voyant-travel/openapi generate`.
