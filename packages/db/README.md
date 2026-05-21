# @voyantjs/db

Database layer for Voyant. Drizzle-based schemas for IAM + infra, runtime adapters for edge, serverless, and Node.js, TypeID columns, CRUD factory, and the runtime LinkService.

## Install

```bash
pnpm add @voyantjs/db drizzle-orm
```

## Usage

```typescript
import { createDbClient, createServerlessDbClient } from "@voyantjs/db"

// Edge reads / no interactive transactions — Neon HTTP adapter
const db = createDbClient(url)

// Cloudflare Workers with real transactions — Neon WebSocket adapter.
// Create inside the request and dispose through the Hono db middleware.
const { db: transactionalDb, dispose } = createServerlessDbClient(url)

// Node.js (workers, scripts) — Postgres.js adapter
const nodeDb = createDbClient(url, { adapter: "node" })
```

```typescript
import { createCrudService } from "@voyantjs/db/crud"
import { createLinkService, syncLinks } from "@voyantjs/db/links"
import { newId } from "@voyantjs/db/lib/typeid"
```

## Schema Imports

Import from exported schema namespaces, not the root barrel:

```typescript
import { apikeyTable } from "@voyantjs/db/schema/iam"
import { webhookSubscriptionsTable } from "@voyantjs/db/schema/infra"
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | `createDbClient`, adapter factories |
| `./lib/typeid` | `newId(prefix)` TypeID generator |
| `./lib/typeid-column` | Drizzle column helper for TypeID |
| `./columns` | Reusable column definitions |
| `./primitives` | Shared primitive tables (catalog, offers, etc.) |
| `./crud` | `createCrudService` — list/retrieve/create/update/delete factory |
| `./links` | `createLinkService`, `syncLinks` runtime link management |
| `./transaction-capability` | Transaction/disposal metadata helpers for runtime database clients |
| `./schema/iam` | IAM schemas — Better Auth, users, API keys, KMS, roles |
| `./schema/infra` | Infra schemas — webhooks, domains, email domain records |
| `./test-utils` | `createTestDb`, `cleanupTestDb` for integration tests |

## License

Apache-2.0
