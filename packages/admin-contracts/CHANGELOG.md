# @voyantjs/admin-contracts

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
