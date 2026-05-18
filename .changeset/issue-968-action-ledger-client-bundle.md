---
"@voyantjs/action-ledger": patch
"@voyantjs/workflow-runs": patch
---

Fix `@voyantjs/action-ledger` dragging database drivers into client bundles (issue #968).

`action-ledger/service.ts` imported `newId` from `@voyantjs/db` (the package root), and `action-ledger/schema.ts` imported `typeId` from the same place. The `@voyantjs/db` root entry pulls `drizzle-orm/postgres-js`, `drizzle-orm/neon-http`, and `postgres`, which references Node's `Buffer`. Any client component that imported a pure constant from `@voyantjs/finance`/`@voyantjs/bookings`/`@voyantjs/products` (e.g. `noDepositPolicy`) — packages whose service trees re-export action-ledger — pulled the entire chain into the browser bundle and crashed at runtime with `ReferenceError: Buffer is not defined`.

Both action-ledger imports now use leaf subpaths (`@voyantjs/db/lib/typeid` for `newId`, `@voyantjs/db/lib/typeid-column` for `typeId`). The remaining `AnyDrizzleDb` reference in `service.ts` is now `import type` only, so it is erased at build time.

`@voyantjs/workflow-runs/schema.ts` had the same top-level `@voyantjs/db` import; switched to the leaf subpath as well to prevent the same regression resurfacing through that package.

Adds a regression guard (`packages/action-ledger/tests/unit/no-db-root-imports.test.ts`) that walks every `packages/*/src/**/*.ts` file in the workspace and fails CI if any non-allow-listed module performs a runtime `import`/`export` from `@voyantjs/db` (the package root). The allow list is just the auth package (`auth/src/server.ts`, `auth/src/edge.ts`), which legitimately needs `getDb`.
