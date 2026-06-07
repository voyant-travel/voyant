# @voyantjs/admin-contracts

## 0.104.3

### Patch Changes

- Updated dependencies [6949669]
  - @voyantjs/crm-contracts@0.105.0

## 0.104.2

### Patch Changes

- Updated dependencies [921f4fc]
  - @voyantjs/products-contracts@0.105.0

## 0.104.1

### Patch Changes

- @voyantjs/bookings-contracts@0.104.1
- @voyantjs/crm-contracts@0.104.1
- @voyantjs/finance-contracts@0.104.1
- @voyantjs/legal-contracts@0.104.1
- @voyantjs/products-contracts@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/bookings-contracts@0.104.0
- @voyantjs/crm-contracts@0.104.0
- @voyantjs/finance-contracts@0.104.0
- @voyantjs/legal-contracts@0.104.0
- @voyantjs/products-contracts@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/bookings-contracts@0.103.0
- @voyantjs/crm-contracts@0.103.0
- @voyantjs/finance-contracts@0.103.0
- @voyantjs/legal-contracts@0.103.0
- @voyantjs/products-contracts@0.103.0

## 0.102.0

### Patch Changes

- @voyantjs/bookings-contracts@0.102.0
- @voyantjs/crm-contracts@0.102.0
- @voyantjs/finance-contracts@0.102.0
- @voyantjs/legal-contracts@0.102.0
- @voyantjs/products-contracts@0.102.0

## 0.101.2

### Patch Changes

- Updated dependencies [577eaf5]
- Updated dependencies [577eaf5]
  - @voyantjs/bookings-contracts@0.101.2
  - @voyantjs/crm-contracts@0.101.2
  - @voyantjs/finance-contracts@0.101.2
  - @voyantjs/legal-contracts@0.101.2
  - @voyantjs/products-contracts@0.101.2

## 0.101.1

### Patch Changes

- @voyantjs/bookings-contracts@0.101.1
- @voyantjs/crm-contracts@0.101.1
- @voyantjs/finance-contracts@0.101.1
- @voyantjs/legal-contracts@0.101.1
- @voyantjs/products-contracts@0.101.1

## 0.101.0

### Minor Changes

- 8e7b56a: Extract products validation into the pure `@voyantjs/products-contracts` package
  and complete the products admin SDK surface.

  - **products-contracts:** now owns the products validation cluster
    (`validation`, `validation-core`, `validation-public`, `validation-shared`,
    `validation-config`, `validation-content`, `validation-catalog`), moved out of
    the runtime `@voyantjs/products` package. Its only external imports — the two
    `@voyantjs/db` helpers — are repointed to `@voyantjs/schema-kit`, so the
    package stays zero-runtime (zod + schema-kit). Mirrors the
    bookings/finance/crm/legal split.
  - **products:** the moved files become one-line re-export stubs, so every
    existing import path (`@voyantjs/products/validation`,
    `@voyantjs/products/public-validation`, and internal `./validation-*`) keeps
    working unchanged.
  - **admin-contracts:** products gains its write descriptors —
    `products.create`/`update`/`delete` deriving from `insertProductSchema`/
    `updateProductSchema`, and `products.list` now derives from
    `productListQuerySchema` — all from the newly-pure `@voyantjs/products-contracts`.
  - **admin-client:** typed `products.create`/`update`/`delete` methods.

### Patch Changes

- Updated dependencies [8e7b56a]
  - @voyantjs/bookings-contracts@0.101.0
  - @voyantjs/crm-contracts@0.101.0
  - @voyantjs/finance-contracts@0.101.0
  - @voyantjs/legal-contracts@0.101.0
  - @voyantjs/products-contracts@0.101.0

## 0.100.0

### Minor Changes

- 061bef2: Expand the Admin API SDK (#1411).

  - **admin-contracts (5.2):** add operation descriptors for CRM (people +
    organizations CRUD, plus the PII-gated person-document reveal), legal
    (contracts CRUD + issue/void, policies CRUD + cancellation evaluation), and
    products (read surface: list/get). Inputs derive from the canonical
    `@voyantjs/crm-contracts` / `@voyantjs/legal-contracts` route schemas; outputs
    are loose client-facing projections. Scopes follow the path+method convention
    `requireActor` enforces (GET→`:read`, POST/PATCH→`:write`, DELETE→`:delete`).
  - **admin-client:** typed `crm`, `legal`, and `products` namespaces over the new
    descriptors.
  - **admin-react (5.3):** new package — a generic React Query adapter over the
    admin client. `AdminClientProvider`/`useAdminClient`, plus descriptor-driven
    `useAdminQuery`, `useAdminMutation`, and `useCapabilities`. Works for any
    operation descriptor (current or future) rather than bespoke per-screen hooks.

### Patch Changes

- @voyantjs/bookings-contracts@0.100.0
- @voyantjs/crm-contracts@0.100.0
- @voyantjs/finance-contracts@0.100.0
- @voyantjs/legal-contracts@0.100.0

## 0.99.0

### Patch Changes

- cb22020: Add a descriptor consistency guard (test): asserts every admin operation
  descriptor is well-formed and internally consistent — unique ids, an
  `/v1/admin/<domain>` path matching the operation's id prefix, a valid
  method/classification, `resource:action` scopes, and a `path()` builder that
  substitutes every template param. Catches the authoring-drift class that makes a
  descriptor diverge from the API surface. (The complementary live route-existence
  check belongs in a deployment test; #1411 5.4.)
  - @voyantjs/bookings-contracts@0.99.0
  - @voyantjs/finance-contracts@0.99.0

## 0.98.0

### Minor Changes

- 161222e: Derive admin operation inputs from the module contracts (single source of truth).

  `@voyantjs/admin-contracts` now derives its operation **input** schemas from the
  canonical route validation in `@voyantjs/bookings-contracts` and
  `@voyantjs/finance-contracts` instead of re-declaring them:

  - `recordPaymentInput` / `createPaymentLinkInput` are now `.pick()`ed from the
    finance route schemas (removing the duplicated `PAYMENT_METHODS` enum), and
    `confirmBookingInput` / `cancelBookingInput` reuse the bookings route schemas.
    This eliminates the descriptor↔route drift class by construction — the SDK
    input is the route's schema.
  - Output DTOs (`BookingSummary`, `InvoiceSummary`, `Payment`) stay curated and
    loose (`status: z.string()`) for forward-compatibility with server-added enum
    values.

  `InferInput` now resolves to `z.input` (the caller-facing, pre-parse type) so
  schema defaults (e.g. a payment `status` that defaults to `"pending"`) are
  optional for the caller rather than required.

### Patch Changes

- @voyantjs/bookings-contracts@0.98.0
- @voyantjs/finance-contracts@0.98.0

## 0.97.0

### Minor Changes

- aa73935: Introduce the Admin API contract + SDK (first slice).

  `@voyantjs/admin-contracts` defines admin operations as typed, versioned,
  transport-agnostic descriptors — `OperationDescriptor` + `defineOperation()`,
  action classification (`read | routine_write | destructive |
requires_confirmation`), shared error/pagination envelopes, and a
  capability-discovery descriptor. It ships the first operation catalogue for
  bookings (list/get/confirm/cancel) and finance (invoice list/get, record
  payment, create payment link). Pure and zod-only.

  `@voyantjs/admin-client` is a framework-neutral client (`createAdminClient`)
  that executes those descriptors from Expo, Node, Workers, and Max/AI tools — no
  React or framework runtime deps. It handles auth (API key / bearer / custom),
  typed `AdminApiError`s, pagination, idempotency keys, and capability discovery.

  The architecture, package boundaries, and roadmap (server `_meta/capabilities`
  route, more domains, React/Expo adapters, Max-tool wrappers) are documented in
  `docs/adr/0003-admin-api-contract-sdk.md`. Web admin, mobile, Max tools, and
  brokers consume one surface, keeping permission and audit semantics consistent.
