# @voyant-travel/quotes

Quotes owns pipelines, stages, quotes, quote versions, quote participants,
quote products, quote version lines, proposal lifecycle decisions, and the
accept-to-reserve booking quote details extension.

People and organizations are referenced by plain ids. This package does not
import Relationships schema tables or own relationship lifecycle state.

## Install

```bash
pnpm add @voyant-travel/quotes
```

## Usage

```typescript
import { quotesModule } from "@voyant-travel/quotes"
import { createApp } from "@voyant-travel/hono"

const app = createApp({
  modules: [quotesModule],
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export, services, public types, linkables |
| `./schema` | Quotes-owned Drizzle tables |
| `./validation` | Quote lifecycle validation schemas |
| `./routes` | Hono routes for pipelines, stages, quotes, and quote versions |
| `./booking-extension` | Booking quote details extension |
| `./tools` | Typed quote reads and guarded proposal snapshot/decision lifecycle Tools |

## Agent Tools

`@voyant-travel/quotes/tools` exposes staff-only quote reads plus the complete proposal lifecycle:
snapshot the current quote lines, mark a draft version sent, and record accept or decline. These
Tools call the existing atomic quote services and return structural, JSON-safe quote/version
records. Snapshot, send, accept, and decline require confirmation and action-ledger recording;
acceptance additionally requires graph approval because it wins the quote and closes competing
versions.

The compatibility aliases `quote_version_snapshot`, `quote_version_send`,
`quote_version_accept`, and `quote_version_decline` preserve the existing hosted invocation names
while consumers migrate to stable capability IDs. Sending records proposal lifecycle state only;
delivery remains owned by the notification/proposal flow.

## License

Apache-2.0
