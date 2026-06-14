# @voyant-travel/relationships

Relationships owns people, organizations, account records, profile context,
person documents, activities, custom fields, segments, customer signals, and
KMS-backed person PII route runtime.

## Install

```bash
pnpm add @voyant-travel/relationships
```

## Usage

```typescript
import { relationshipsModule } from "@voyant-travel/relationships"
import { createApp } from "@voyant-travel/hono"

const app = createApp({
  modules: [relationshipsModule],
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export, services, public types, linkables |
| `./events` | Customer signal event names, payload types, and emit helpers |
| `./schema` | Relationships-owned Drizzle tables |
| `./validation` | Relationships validation schemas |
| `./routes` | Hono routes for people, organizations, activities, signals, documents, and custom fields |

## License

Apache-2.0
