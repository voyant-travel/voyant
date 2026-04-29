# @voyantjs/notifications

Notifications module for Voyant. It includes:

- provider abstraction via `NotificationProvider`
- first-party providers for local development and Voyant Cloud (email + SMS)
- database-backed notification templates
- database-backed delivery logs
- notification reminder rules and reminder runs
- finance-aware send flows for invoices and payment sessions
- booking document bundle/list + send flows for contract and invoice/proforma
  artifacts
- routes for template management, delivery listing, reminder management, and sending

CRM communication history should remain a business-facing log. This module owns transport templates, delivery attempts, provider message ids, and reminder-oriented operational sends.

## Install

```bash
pnpm add @voyantjs/notifications
```

## Usage

```typescript
import { getVoyantCloudClient } from "@voyantjs/voyant-cloud"
import { createNotificationService } from "@voyantjs/notifications"
import { createLocalProvider } from "@voyantjs/notifications/providers/local"
import { createVoyantCloudEmailProvider } from "@voyantjs/notifications/providers/voyant-cloud-email"
import { createVoyantCloudSmsProvider } from "@voyantjs/notifications/providers/voyant-cloud-sms"

const cloud = getVoyantCloudClient(env)
const notifications = createNotificationService([
  createLocalProvider({ channels: ["email"] }),
  createVoyantCloudEmailProvider({ client: cloud, from: "noreply@example.com" }),
  createVoyantCloudSmsProvider({ client: cloud }),
])

await notifications.send({
  to: "user@example.com",
  channel: "email",
  template: "welcome",
  subject: "Hello",
  html: "<p>Welcome</p>",
})
```

Later providers override earlier ones on channel conflict; `sendWith(name, payload)` dispatches by provider name.

The bring-your-own path is first-class: any project can implement
`NotificationProvider` against another transport (raw Resend, Twilio, SES, …)
and register it in place of the cloud adapters.

For the Hono module:

```ts
import { getVoyantCloudClient } from "@voyantjs/voyant-cloud"
import {
  createNotificationsHonoModule,
  createVoyantCloudEmailProvider,
  createVoyantCloudSmsProvider,
} from "@voyantjs/notifications"

const notificationsModule = createNotificationsHonoModule({
  resolveProviders: (env) => {
    const cloud = getVoyantCloudClient(env as Record<string, unknown>)
    return [
      createVoyantCloudEmailProvider({ client: cloud, from: "noreply@example.com" }),
      createVoyantCloudSmsProvider({ client: cloud }),
    ]
  },
})
```

For scheduled reminder sweeps:

```ts
import { sendDueNotificationReminders } from "@voyantjs/notifications/tasks"

await sendDueNotificationReminders(db, process.env, {
  now: "2026-04-08T09:00:00.000Z",
})
```

Reminder rules can currently target:

- `booking_payment_schedule`
- `invoice`

For finance-aware collection sends, the routes also support:

- `POST /payment-sessions/:id/send`
- `POST /invoices/:id/send`
- `GET /bookings/:id/document-bundle`
- `POST /bookings/:id/send-documents`

Those routes resolve recipients from the payment session, invoice, and linked booking travelers, then render the selected notification template with finance context such as payment links, invoice balances, and booking references.

Booking document sends bundle the latest customer-facing contract attachment and
ready invoice/proforma rendition for a booking. By default they use the stored
artifact URL when one is durable and publicly readable. Private document flows
should override that behavior with `documentAttachmentResolver` or
`resolveDocumentAttachmentResolver` when mounting `createNotificationsRoutes()`
or `createNotificationsHonoModule()`, so attachment URLs are resolved at send
time from the current storage/runtime context.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./schema` | Drizzle tables and module definitions |
| `./types` | `NotificationProvider`, payload types |
| `./validation` | Zod schemas for templates, deliveries, reminders, send input |
| `./routes` | Hono route factory |
| `./service` | Dispatcher + database-backed notifications service |
| `./tasks` | Reminder sweep task helpers |
| `./providers/local` | Console sink for dev |
| `./providers/voyant-cloud-email` | Voyant Cloud email provider |
| `./providers/voyant-cloud-sms` | Voyant Cloud SMS provider |

## License

Apache-2.0
