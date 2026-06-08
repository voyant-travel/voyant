# @voyantjs/crm

CRM module for Voyant. People and organizations are the canonical person/company entities across the workspace. Includes pipelines, Quotes, Quote Versions, activities, custom fields, notes, communications, segments, and CSV import/export.

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
- **Quotes** (`quot`, `qprt`, `qprd`) — sales artifacts attached to people/orgs
- **Quote Versions** + **Quote Version lines** (`qver`, `qtln`)
- **Activities** (`act`, `actl`, `actp`) — tasks, calls, meetings, emails
- **Custom fields** (`cfdf`, `cfvl`)
- **Notes** — person (`pnot`), organization (`onot`)
- **Communication log** (`clog`)
- **Segments** + **segment members** (`seg`, `segm`)
- **Customer signals** (`csg`) — inquiry, wishlist, notify, request-offer, and referral signals used by admin CRM and public storefront intake

## Events

`customer.signal.created` is emitted when public storefront intake accepts a
lead or newsletter subscription. Subscribe to it from app code to send
operator notifications:

```ts
eventBus.subscribe("customer.signal.created", async ({ data }) => {
  if (data.intake?.surface === "storefront") {
    await notifySalesTeam(data.id)
  }
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export + public types |
| `./events` | CRM event names, payload types, and emit helpers |
| `./schema` | Drizzle tables + linkable definitions |
| `./validation` | Zod schemas |
| `./routes` | Hono routes for admin/public surfaces |

## License

Apache-2.0
