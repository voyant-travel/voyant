# @voyantjs/db

Database layer for Voyant. Drizzle-based schemas for IAM + infra, runtime adapters for edge and Node.js, TypeID columns, CRUD factory, and the runtime LinkService.

## Install

```bash
pnpm add @voyantjs/db drizzle-orm
```

## Usage

```typescript
import { createDbClient } from "@voyantjs/db"

// Edge/Serverless (Cloudflare Workers) — Neon HTTP adapter
const db = createDbClient(url)

// Node.js (workers, scripts) — Postgres.js adapter
const db = createDbClient(url, { adapter: "node" })
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
| `./schema/iam` | IAM schemas — Better Auth, users, API keys, KMS, roles |
| `./schema/infra` | Infra schemas — webhooks, domains, email domain records |
| `./test-utils` | `createTestDb`, `cleanupTestDb` for integration tests |

## License

Apache-2.0
