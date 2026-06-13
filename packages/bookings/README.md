# @voyantjs/bookings

Bookings module for Voyant. Manages booking lifecycle with travelers, supplier statuses, activity log, and notes. Uses `personId` + `organizationId` from CRM as client snapshot.

## Install

```bash
pnpm add @voyantjs/bookings
```

## Usage

```typescript
import { bookingsModule } from "@voyantjs/bookings"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [bookingsModule],
  // ...
})
```

## Public storefront flow

The public routes include:

- `POST /v1/public/bookings/sessions`
- `GET /v1/public/bookings/sessions/:sessionId`
- `PUT /v1/public/bookings/sessions/:sessionId/state`
- `POST /v1/public/bookings/sessions/:sessionId/reprice`
- `GET /v1/public/bookings/overview`

Session reads now include first-class persisted wizard state, and repricing
supports both preview mode and `applyToSession` mode for committing the priced
room/unit selection back onto the booking session totals.

## Origin and provenance

Bookings owns durable booking origin records in `booking_origins`. The origin
row is keyed by `booking_id` and can point at accepted Quote Versions, Trip
snapshots, reservation plans, Catalog price/availability responses, Catalog
booking snapshots, provider/source order refs, and legacy migrated transaction
ids. New booking flows should write this owner path instead of
the retired booking-to-transaction detail join.

## Action-ledger approvals

Agent/workflow booking status mutations that require approval return `202` with
the requested action and approval ids. These approval-required requests must
send `Idempotency-Key`; the key is fingerprinted with the command input and
approval policy inputs, so replaying the key with different input returns a
conflict.

After an approval is approved, execute the same status mutation again with the
`ACTION_LEDGER_APPROVAL_ID_HEADER` header from `@voyantjs/action-ledger`. The
route validates that the approval is approved, unexpired, linked to the same
requested action and current principal, and command-equivalent to the original
request before it mutates the booking. Approved execution ledger fields are
stamped through `buildActionLedgerApprovedExecutionFields(...)` so execution
entries consistently link back to the requested action and approval.

## Entities

- **Bookings** (`book`)
- **Booking travelers** (`bkps`)
- **Booking origins** (`booking_origins`)
- **Booking supplier statuses** (`bkss`)
- **Booking activity log** (`bkal`)
- **Booking notes** (`bnot`)
- **Booking session states** (`bkst`)

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export + service |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |
| `./requirements` | Booking requirements service and routes |

## License

Apache-2.0
