---
"@voyantjs/db": minor
"@voyantjs/core": minor
"@voyantjs/hono": minor
"@voyantjs/action-ledger": patch
"@voyantjs/availability": patch
"@voyantjs/bookings": patch
"@voyantjs/charters": patch
"@voyantjs/crm": patch
"@voyantjs/cruises": patch
"@voyantjs/finance": patch
"@voyantjs/legal": patch
"@voyantjs/notifications": patch
"@voyantjs/transactions": patch
---

Extract `withOptionalTransaction` into `@voyantjs/db/transaction` so the soft-fallback helper that action-ledger has used since 0.62.0 can be shared by any package that needs it. Add `Module.requiresTransactionalDb` so modules whose write paths use interactive transactions declare it, and have `createApp()` assert on first request that the resolved db adapter supports `db.transaction(async (tx) => …)`. With the neon-http (edge) adapter that assertion now throws an actionable error pointing at `createServerlessDbClient` (neon-serverless / WebSocket) or `createDbClient(url, { adapter: "node" })` — instead of the cryptic "No transactions support in neon-http driver" exception thrown on first write.
