# @voyantjs/admin-client

A framework-neutral TypeScript client for the Voyant Admin API. Built on the
typed operation descriptors in [`@voyantjs/admin-contracts`](../admin-contracts/README.md),
it runs in **Expo, Node, Cloudflare Workers, and Max/AI tools** — no React, no
web-UI, no framework runtime dependencies.

See [`docs/adr/0003-admin-api-contract-sdk.md`](../../docs/adr/0003-admin-api-contract-sdk.md).

## Usage

```ts
import { createAdminClient } from "@voyantjs/admin-client"

const client = createAdminClient({
  baseUrl: "https://acme.voyant.app",
  auth: { type: "apiKey", apiKey: "voy_live_..." },
  idempotencyKey: (op) => `${op}:${crypto.randomUUID()}`,
})

// Discover what this deployment supports
const caps = await client.capabilities()

// Bookings
const { data, total } = await client.bookings.list({ status: "on_hold", limit: 20 })
const booking = await client.bookings.get({ id: "book_123" })
await client.bookings.confirm({ id: "book_123" }, { note: "supplier confirmed" })

// Finance
await client.finance.payments.record(
  { id: "inv_9" },
  { amountCents: 50000, currency: "EUR", paymentMethod: "bank_transfer", paymentDate: "2026-06-01" },
)
const link = await client.finance.paymentLinks.create(
  { id: "inv_9" },
  { amountCents: 50000, currency: "EUR", returnUrl: "https://acme.app/thanks" },
)
```

## What it handles

- **Auth** — `apiKey` (`voy_` keys), `bearer` (session JWT), or `custom` header
  injection.
- **Typed errors** — non-2xx responses throw `AdminApiError` carrying `status`,
  `code`, and `requestId`.
- **Pagination** — list operations return the `{ data, total, limit, offset }`
  envelope; query params are serialized for you.
- **Idempotency** — an `Idempotency-Key` header is attached to idempotent
  operations when you supply `idempotencyKey`.
- **Capability discovery** — `client.capabilities()` reports enabled modules,
  operations, deployment version, and required scopes.

The same operation invoked here is the same descriptor a Max-tool wrapper uses,
so permission and audit semantics stay identical across callers.
