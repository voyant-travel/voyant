# @voyantjs/admin-client

## 0.99.0

### Patch Changes

- Updated dependencies [cb22020]
  - @voyantjs/admin-contracts@0.99.0

## 0.98.0

### Patch Changes

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

- Updated dependencies [161222e]
  - @voyantjs/admin-contracts@0.98.0

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

### Patch Changes

- Updated dependencies [aa73935]
  - @voyantjs/admin-contracts@0.97.0
