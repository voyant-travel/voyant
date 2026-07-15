# @voyant-travel/notifications

Notifications module for Voyant. It includes:

- provider abstraction via `NotificationProvider`
- first-party providers for local development and Voyant Cloud (email + SMS)
- database-backed notification templates
- database-backed delivery logs
- exact-idempotent delivery attempts with command-drift detection
- notification reminder rules and reminder runs
- finance-aware send flows for invoices and payment sessions
- booking document bundle/list + send flows for contract and invoice/proforma
  artifacts
- routes for template management, delivery listing, reminder management, and sending

CRM communication history should remain a business-facing log. This module owns transport templates, delivery attempts, provider message ids, and reminder-oriented operational sends.

Package composers can depend on narrow delivery ports without reading or writing Notifications
tables. The Quotes proposal composer uses `quotes.notifications.runtime`; Notifications implements
that port with vetted-template delivery and a durable unique idempotency key. Replays return the
original delivery, including failed or in-flight attempts, so retries never create a second send.

## Install

```bash
pnpm add @voyant-travel/notifications
```

## Usage

```typescript
import { getVoyantCloudClient } from "@voyant-travel/voyant-cloud"
import { createNotificationService } from "@voyant-travel/notifications"
import { createLocalProvider } from "@voyant-travel/notifications/providers/local"
import { createVoyantCloudEmailProvider } from "@voyant-travel/notifications/providers/voyant-cloud-email"
import { createVoyantCloudSmsProvider } from "@voyant-travel/notifications/providers/voyant-cloud-sms"

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

Email sends resolve the sender from the request `from`, the template
`fromAddress`, or the provider's `defaultFromAddress` before dispatch. Custom
email providers that use a provider-side default sender should expose it through
`defaultFromAddress`; otherwise direct email sends without an explicit sender
fail before the provider is called.

For the API module:

```ts
import { getVoyantCloudClient } from "@voyant-travel/voyant-cloud"
import {
  createNotificationsApiModule,
  createVoyantCloudEmailProvider,
  createVoyantCloudSmsProvider,
} from "@voyant-travel/notifications"

const notificationsModule = createNotificationsApiModule({
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
import { sendDueNotificationReminders } from "@voyant-travel/notifications/tasks"

await sendDueNotificationReminders(db, process.env, {
  now: "2026-04-08T09:00:00.000Z",
})
```

Reminder rules can currently target:

- `booking_payment_schedule`
- `invoice`

Stage cadence and `maxSendsInStage` are evaluated against reminder run attempts.
A queued, sent, skipped, or failed run consumes the stage slot; failed runs are
terminal until an operator or explicit recovery flow requeues them. When a stage
omits `maxSendsInStage`, it defaults to one send; set an explicit finite cap for
stages that should repeat.

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
or `createNotificationsApiModule()`, so attachment URLs are resolved at send
time from the current storage/runtime context.

## Booking Document Bundle Lifecycle

`createNotificationsApiModule()` can subscribe to booking confirmation and
fully-paid lifecycle signals through `documentBundleLifecycle`. The hook
resolves the booking, primary customer/recipient, travelers, booking items, and
existing legal/finance document bundle before invoking the configured policy.

```ts
const notificationsModule = createNotificationsApiModule({
  resolveDb: (bindings) => getDbFromEnv(bindings),
  resolveProviders,
  documentBundleLifecycle: {
    enabled: true,
    confirmation: {
      notification: { templateSlug: "booking-confirmation" },
    },
    fullyPaid: {
      documentTypes: ["contract", "invoice"],
      notification: { templateSlug: "booking-paid-in-full" },
    },
    ensureLegalDocuments: async (context) => {
      await generateContractForBooking(context.booking.id)
    },
    ensureFinanceDocuments: async (context, request) => {
      await generateInvoiceDocuments(context.booking.id, request.documentTypes)
    },
    notificationPolicy: async (context, result) => ({
      templateSlug:
        context.trigger === "booking.fully-paid"
          ? "booking-paid-in-full"
          : "booking-confirmation",
      documentTypes: result.documents.map((document) => document.documentType),
    }),
  },
})
```

The default policy is idempotent by document type: confirmation asks for
`contract` + `proforma`, and fully-paid asks for `contract` + `invoice`. If a
contract was already generated at confirmation, the fully-paid hook records it
as existing and only calls the configured finance generator for the missing
invoice. Generator exceptions are returned as failed lifecycle results and the
module subscriber logs booking id plus status only; it does not log document
contents, attachment bodies, or customer data.

Host apps can replace the entire policy with `policy`, or keep the default
composition and override only `notificationPolicy`. Product brochures remain an
extension point via `resolveBrochureDocuments`, so apps that install
`@voyant-travel/inventory` can add current brochure artifacts without making
notifications depend on products at runtime.

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
