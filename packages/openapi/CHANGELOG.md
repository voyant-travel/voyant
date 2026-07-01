# @voyant-travel/openapi

## 0.3.0

### Minor Changes

- 86fbb05: Generate OpenAPI specs per module instead of committing one giant aggregate.

  `@voyant-travel/hono/openapi` gains `generateModuleOpenApiDocuments` (one
  self-contained document per module, built directly from the routes that module
  registered) and `splitDocumentByModule` (partitions a composed document so every
  admin/storefront path lands in exactly one module document — the module manifest
  is the authoritative owner, with the path's own segment as the fallback for
  routes no module claims, e.g. `additionalRoutes` mounts). The composed app now
  records an `app.moduleMounts` manifest (mirroring `app.lazyMounts`) so the
  generator knows each module's real mount prefix, including `publicPath` overrides
  whose prefix isn't the module name (e.g. `/v1/public/booking-engine`).

  `@voyant-travel/openapi` now ships compact, browsable per-module specs under
  `spec/{admin,storefront}/<module>.json`, exposed via new `./admin/*` and
  `./storefront/*` subpath exports (e.g.
  `import bookings from "@voyant-travel/openapi/admin/bookings"`). The
  multi-megabyte aggregate specs (`framework-openapi.json` / `-admin` /
  `-storefront`) are no longer committed to git — GitHub can't render a 7 MB file
  and any route change rewrote the whole thing — but they're still published in
  the npm tarball (generated at `prepack`) and produced locally by `build`, so the
  `.` / `./admin` / `./storefront` exports keep resolving.

## 0.2.6

### Patch Changes

- cc29167: Require public document delivery grants for public contract read/sign routes and return signer-safe contract/signature payloads.

## 0.2.5

### Patch Changes

- bb3b29c: Regenerate the committed framework OpenAPI artifacts to include the new anonymous `GET /v1/public/markets` discovery route. The `full` (`framework-openapi.json`) and `storefront` (`framework-storefront.json`) documents now describe the public market/locale/currency discovery surface; `framework-admin.json` is unchanged.

## 0.2.4

### Patch Changes

- 53f949c: Filter legal policy detail acceptances by the current policy so unrelated policy version acceptances are not shown.

## 0.2.3

### Patch Changes

- c1d45bc: Normalize booking journey quote shapes before rendering so missing or malformed descriptor slices fall back safely instead of crashing storefront booking flows.

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
