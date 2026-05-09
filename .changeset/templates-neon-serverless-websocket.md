---
"@voyantjs/db": minor
"@voyantjs/hono": minor
---

Closes #500: switch both templates' Workers DB layer from Hyperdrive to the Neon serverless WebSocket driver. Drops the \`HYPERDRIVE\` binding from \`wrangler.jsonc\` + \`env.d.ts\` in both \`templates/dmc\` and \`templates/operator\`; templates now connect directly via \`@neondatabase/serverless\` Pool + \`drizzle-orm/neon-serverless\` using the same \`DATABASE_URL\` secret.

Two helpers ship in each template's \`src/api/lib/db.ts\`:

- \`getDbFromEnv(env, executionCtx?)\` — returns a per-request \`NeonDatabase\`. When \`executionCtx\` is passed, schedules \`pool.end()\` via \`waitUntil\` so the WebSocket closes promptly. When omitted, the Pool is left for the Workers runtime to reclaim on isolate teardown.
- \`withDbFromEnv(env, fn)\` — higher-order helper for non-Hono code paths (event subscribers, scheduled handlers, retry workers). Owns the Pool lifecycle inline (open → \`fn\` → \`finally pool.end()\`).

Touched packages get a minor bump because the shared types broaden:

- \`@voyantjs/db\` — \`AnyDrizzleDb\` union now includes \`NeonDatabase\` from \`drizzle-orm/neon-serverless\` alongside the existing \`PostgresJsDatabase\` and \`NeonHttpDatabase\` flavors.
- \`@voyantjs/hono\` — \`VoyantDb\` (the type Hono ctx variables expose under \`c.var.db\`) widens the same way.

Why WebSocket and not HTTP: the bookings package and other internal services use \`db.transaction(...)\` for read-then-write logic that needs real Postgres transaction semantics. Neon's HTTP transport only batches statements (atomic but no isolation); WebSocket gives full transaction support on Workers.

Subscribers in \`catalog-bridge\`, \`booking-schedule\`, \`smartbill\`, \`catalog-checkout\` were converted to \`withDbFromEnv\` so the Pool is owned by each subscriber call. \`getBetterAuth\` and other helpers that were hard to thread \`executionCtx\` through still call \`getDbFromEnv(env)\` without it — the Pool lingers until isolate teardown there. Tracked as a follow-up audit in #510.

No schema migration. No behavior change for existing API contracts. Operators upgrading need to: drop the \`HYPERDRIVE\` binding from their \`wrangler.jsonc\` (if they had one), and ensure their \`DATABASE_URL\` points at a Neon Postgres reachable over WebSocket (the standard Neon connection string).
