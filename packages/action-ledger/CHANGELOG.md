# @voyantjs/action-ledger

## 0.59.0

### Patch Changes

- @voyantjs/core@0.59.0
- @voyantjs/db@0.59.0
- @voyantjs/hono@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/core@0.58.0
- @voyantjs/db@0.58.0
- @voyantjs/hono@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/core@0.57.0
- @voyantjs/db@0.57.0
- @voyantjs/hono@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/core@0.56.0
- @voyantjs/db@0.56.0
- @voyantjs/hono@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/core@0.55.1
  - @voyantjs/db@0.55.1
  - @voyantjs/hono@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/core@0.55.0
- @voyantjs/db@0.55.0
- @voyantjs/hono@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/core@0.54.0
- @voyantjs/db@0.54.0
- @voyantjs/hono@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/core@0.53.2
- @voyantjs/db@0.53.2
- @voyantjs/hono@0.53.2

## 0.53.1

### Patch Changes

- 8ebac16: Fix `@voyantjs/action-ledger` dragging database drivers into client bundles (issue #968).

  `action-ledger/service.ts` imported `newId` from `@voyantjs/db` (the package root), and `action-ledger/schema.ts` imported `typeId` from the same place. The `@voyantjs/db` root entry pulls `drizzle-orm/postgres-js`, `drizzle-orm/neon-http`, and `postgres`, which references Node's `Buffer`. Any client component that imported a pure constant from `@voyantjs/finance`/`@voyantjs/bookings`/`@voyantjs/products` (e.g. `noDepositPolicy`) — packages whose service trees re-export action-ledger — pulled the entire chain into the browser bundle and crashed at runtime with `ReferenceError: Buffer is not defined`.

  Both action-ledger imports now use leaf subpaths (`@voyantjs/db/lib/typeid` for `newId`, `@voyantjs/db/lib/typeid-column` for `typeId`). The remaining `AnyDrizzleDb` reference in `service.ts` is now `import type` only, so it is erased at build time.

  `@voyantjs/workflow-runs/schema.ts` had the same top-level `@voyantjs/db` import; switched to the leaf subpath as well to prevent the same regression resurfacing through that package.

  Adds a regression guard (`packages/action-ledger/tests/unit/no-db-root-imports.test.ts`) that walks every `packages/*/src/**/*.ts` file in the workspace and fails CI if any non-allow-listed module performs a runtime `import`/`export` from `@voyantjs/db` (the package root). The allow list is just the auth package (`auth/src/server.ts`, `auth/src/edge.ts`), which legitimately needs `getDb`.

  - @voyantjs/core@0.53.1
  - @voyantjs/db@0.53.1
  - @voyantjs/hono@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/core@0.53.0
- @voyantjs/db@0.53.0
- @voyantjs/hono@0.53.0

## 0.52.4

### Patch Changes

- @voyantjs/core@0.52.4
- @voyantjs/db@0.52.4
- @voyantjs/hono@0.52.4

## 0.52.3

### Patch Changes

- 9679a57: Add the initial action ledger package with append-only ledger schemas, TypeID prefixes, canonical idempotency fingerprints, capability registry and guard helpers, query helpers, request-context ledger helpers, shared target timeline serialization, payload/relay append support, booking PII sensitive-read ledgering, booking traveler and travel-detail mutation ledgering, booking item/note/payment-policy mutation ledgering, booking action capability declarations and approval decision routing, booking action-ledger drift checks and dry-run remediation planning, finance invoice issuance/update/delete, invoice line-item ledgering, payment-session creation/update/lifecycle completion/failure/cancellation/expiration, payment instrument and authorization/capture ledgering, booking payment schedule and guarantee/default-plan ledgering, manual payment, supplier payment, and credit-note plus credit-note line-item ledgering, product create/update/delete ledgering with changed-field summaries and product timelines, nested product option, option-unit, translation, itinerary, day, day-service, media, brochure, feature, FAQ, location, taxonomy-link, destination-link, activation-setting, ticket-setting, visibility-setting, capability, and delivery-format mutation ledgering, product action-ledger drift checks, product admin route module splitting, admin list/detail routes with expanded filters and time windows plus payload and relay refs, relay outbox health listing with time windows and lifecycle helpers, runtime schema/route mounting, finance React client hooks for invoice and payment-session action ledger timelines, operator invoice/payment-session timeline mounting, product React client hooks and product detail activity UI, drift/canary health helpers and operator health endpoints, reversal recording support, route schema module split, client-safe React validation subpath imports, and reusable finance UI action ledger cards.
- Updated dependencies [9679a57]
  - @voyantjs/core@0.52.3
  - @voyantjs/db@0.52.3
  - @voyantjs/hono@0.52.3
