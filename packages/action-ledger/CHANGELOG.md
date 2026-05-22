# @voyantjs/action-ledger

## 0.74.0

### Patch Changes

- @voyantjs/core@0.74.0
- @voyantjs/db@0.74.0
- @voyantjs/hono@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/core@0.73.1
- @voyantjs/db@0.73.1
- @voyantjs/hono@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/core@0.73.0
- @voyantjs/db@0.73.0
- @voyantjs/hono@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/core@0.72.0
- @voyantjs/db@0.72.0
- @voyantjs/hono@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/core@0.71.0
- @voyantjs/db@0.71.0
- @voyantjs/hono@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/core@0.70.0
- @voyantjs/db@0.70.0
- @voyantjs/hono@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/core@0.69.1
- @voyantjs/db@0.69.1
- @voyantjs/hono@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/core@0.69.0
- @voyantjs/db@0.69.0
- @voyantjs/hono@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/core@0.68.0
- @voyantjs/db@0.68.0
- @voyantjs/hono@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/core@0.67.0
- @voyantjs/db@0.67.0
- @voyantjs/hono@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/core@0.66.6
- @voyantjs/db@0.66.6
- @voyantjs/hono@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/core@0.66.5
- @voyantjs/db@0.66.5
- @voyantjs/hono@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/core@0.66.4
- @voyantjs/db@0.66.4
- @voyantjs/hono@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/core@0.66.3
- @voyantjs/db@0.66.3
- @voyantjs/hono@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/core@0.66.2
- @voyantjs/db@0.66.2
- @voyantjs/hono@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/core@0.66.1
- @voyantjs/db@0.66.1
- @voyantjs/hono@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/core@0.66.0
- @voyantjs/db@0.66.0
- @voyantjs/hono@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/core@0.65.0
- @voyantjs/db@0.65.0
- @voyantjs/hono@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/core@0.64.1
- @voyantjs/db@0.64.1
- @voyantjs/hono@0.64.1

## 0.64.0

### Patch Changes

- 6d0c8f3: Extract `withOptionalTransaction` into `@voyantjs/db/transaction` so the soft-fallback helper that action-ledger has used since 0.62.0 can be shared by any package that needs it. Add `Module.requiresTransactionalDb` so modules whose write paths use interactive transactions declare it, and have `createApp()` assert on first request that the resolved db adapter supports `db.transaction(async (tx) => …)`. With the neon-http (edge) adapter that assertion now throws an actionable error pointing at `createServerlessDbClient` (neon-serverless / WebSocket) or `createDbClient(url, { adapter: "node" })` — instead of the cryptic "No transactions support in neon-http driver" exception thrown on first write.
- Updated dependencies [6d0c8f3]
  - @voyantjs/core@0.64.0
  - @voyantjs/db@0.64.0
  - @voyantjs/hono@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/core@0.63.1
- @voyantjs/db@0.63.1
- @voyantjs/hono@0.63.1

## 0.63.0

### Patch Changes

- @voyantjs/core@0.63.0
- @voyantjs/db@0.63.0
- @voyantjs/hono@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/core@0.62.3
- @voyantjs/db@0.62.3
- @voyantjs/hono@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/core@0.62.2
- @voyantjs/db@0.62.2
- @voyantjs/hono@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/core@0.62.1
- @voyantjs/db@0.62.1
- @voyantjs/hono@0.62.1

## 0.62.0

### Patch Changes

- 77aad68: Add a transaction-capable Neon serverless database adapter and make action-ledger skip Neon HTTP transactions safely.
- Updated dependencies [77aad68]
  - @voyantjs/core@0.62.0
  - @voyantjs/db@0.62.0
  - @voyantjs/hono@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/core@0.61.0
- @voyantjs/db@0.61.0
- @voyantjs/hono@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/core@0.60.0
- @voyantjs/db@0.60.0
- @voyantjs/hono@0.60.0

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
