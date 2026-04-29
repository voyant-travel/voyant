# @voyantjs/crm

CRM module for Voyant. People and organizations are the canonical person/company entities across the workspace. Includes pipelines, opportunities, quotes, activities, custom fields, notes, communications, segments, and CSV import/export.

## Install

```bash
pnpm add @voyantjs/crm
```

## Usage

```typescript
import { crmModule } from "@voyantjs/crm"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [crmModule],
  // ...
})
```

## Entities

- **People** (`pers`) — canonical person record; syncs inline contact fields (email, phone, website) to `identity` module, while addresses are managed as dedicated identity address resources
- **Organizations** (`org`) — canonical company record
- **Pipelines** + **Stages** (`pipe`, `stg`) — sales funnels
- **Opportunities** (`opp`, `oppp`) — deals attached to people/orgs
- **Quotes** + **Quote lines** (`quot`, `qtln`)
- **Activities** (`act`, `actl`, `actp`) — tasks, calls, meetings, emails
- **Custom fields** (`cfdf`, `cfvl`)
- **Notes** — person (`pnot`), organization (`onot`)
- **Communication log** (`clog`)
- **Segments** + **segment members** (`seg`, `segm`)

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export + public types |
| `./schema` | Drizzle tables + linkable definitions |
| `./validation` | Zod schemas |
| `./routes` | Hono routes for admin/public surfaces |

## License

Apache-2.0
