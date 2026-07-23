# @voyant-travel/finance

Finance module for Voyant. Invoices, payments, credit notes, supplier payments, and finance notes.

## Composed agent commands

`create_booking` is owned by the Finance booking-create extension because that package
already owns the composer spanning product conversion, travelers, room/item
lines, payment schedules, optional credits and group membership, invoices, ledger
records, and post-commit events. The Tool is a structural adapter over that service.
Its selected action policy is handler-owned: the service records the canonical booking
id in the authoritative `booking.create` ledger entry, while the generic pre-dispatch
gate cannot know that id safely. The booking transaction commits before some finance
and document stages, so this command is not yet an exact-replay boundary.

`issue_invoice_from_booking` creates and issues either an invoice or proforma through
the same package-owned composer used by the HTTP route. Agent execution requires an
idempotency key and exact approval. Approved execution records approval and causation
in the action ledger; replaying an already executed approval returns the original
invoice rather than issuing a duplicate.

## Agent Tools

`issue_invoice_refund` defines a refund as issuing an `issued` credit note
against an invoice through the existing credit-note domain service. Agent
callers cannot issue it directly: the first call creates a pending action-ledger
approval, and execution requires the approved id plus an exact match on the
principal, command, current invoice snapshot, and fingerprint. Successful
execution is recorded as `finance.credit_note.issue_refund`, linked to the
requested action and approval, and requires `finance:refund`.

## Install

```bash
pnpm add @voyant-travel/finance
```

## Usage

```typescript
import { financeModule } from "@voyant-travel/finance"
import { createApp } from "@voyant-travel/hono"

const app = createApp({
  modules: [financeModule],
  // ...
})
```

## Entities

- **Invoices** + **Invoice lines** (`inv`, `inli`)
- **Payments** (`pay`)
- **Credit notes** + **Credit note lines** (`crn`, `cnli`)
- **Supplier payments** (`spay`)
- **Finance notes** (`fnot`)
- **Invoice number series** (`invs`)
- **Invoice templates** (`invt`)
- **Invoice renditions** (`invr`)
- **Tax regimes** (`txrg`)
- **Invoice external refs** (`iner`)

## Invoice Rendition Events

Use `financeService.bindInvoiceRendition(db, invoiceId, artifact, { eventBus })`
when a rendered invoice artifact has already been stored and should be bound to
the invoice as the ready rendition. The helper creates the `invoice_renditions`
row with `status: "ready"` inside a transaction, optionally marks previous
renditions of the same format as `stale` when `replaceExisting` is true, and
then emits `invoice.rendered` after the transaction commits.

`invoice.rendered` is an internal service event. Subscribers receive metadata
only:

- `invoiceId`
- `invoiceStatus`
- `invoiceType`
- `renditionId`
- `format`
- `storageKey`
- `contentType`
- `byteSize`
- `contentHash`

The event does not include rendered document bodies or signed download URLs.
Subscriber failures do not roll back the rendition write; use a durable job or
workflow when a downstream reaction needs retries.

## Customer-Safe Document Lookup

Public finance routes include booking-scoped document lookup for customer
portal and checkout surfaces:

- `GET /v1/public/finance/bookings/:bookingId/documents`
- `GET /v1/public/finance/bookings/:bookingId/documents/by-reference?reference=...`
- `GET /v1/public/finance/documents/by-reference?reference=...`

Booking-scoped routes require a checkout capability for the requested booking.
The by-reference variant resolves invoice numbers and payment reference numbers
only inside that booking, so a valid capability for one booking cannot retrieve
documents from another booking.

## Checkout Collection

Finance owns the checkout collection runtime under the `./checkout`,
`./checkout-routes`, and `./checkout-validation` subpaths. Provider startup is
injected through payment starters, bank-transfer details are resolved through
host wiring, and notification delivery stays behind a dispatcher instead of a
direct package dependency.

Mounted Finance routes include:

- `POST /v1/public/finance/bookings/:bookingId/collection-plan`
- `POST /v1/public/finance/bookings/:bookingId/initiate-collection`
- `POST /v1/public/finance/collections/bootstrap`
- `GET /v1/admin/finance/bookings/:bookingId/reminder-runs`

## Booking Tax Preview

Booking creation UIs can show the same tax line that booking finalization will
persist by mounting the booking-tax extensions. The surface is split in two:
tax **settings** live on the finance admin surface, and tax **preview** lives on
the bookings admin surface:

```typescript
import {
  createBookingTaxSettingsApiExtension,
  createBookingTaxPreviewApiExtension,
} from "@voyant-travel/finance/booking-tax"

createApp({
  extensions: [
    createBookingTaxSettingsApiExtension({
      resolveBookingTaxSettings: async (db) => {
        const settings = await getTaxSettings(db)
        return {
          taxPriceMode: settings?.taxPriceMode ?? "inclusive",
          taxPolicyProfileId: settings?.taxPolicyProfileId ?? null,
        }
      },
      updateBookingTaxSettings: async (db, next) => saveTaxSettings(db, next),
    }),
    createBookingTaxPreviewApiExtension({
      resolveBookingTaxSettings: async (db) => getTaxSettings(db),
    }),
  ],
})
```

The settings callback is the storage seam. A template can read a singleton
settings table, KV, environment configuration, or any other deployment-owned
store, while `@voyant-travel/finance` owns the tax policy rule walker, tax-regime
lookup, product tax-class fallback, and inclusive/exclusive math.

Templates that already mount custom routes can call
`mountBookingTaxSettingsRoutes(...)` / `mountBookingTaxPreviewRoutes(...)` from
the same entrypoint instead of using the API extensions.

Mounting these routes registers:

- `GET /v1/admin/finance/tax-settings`
- `PATCH /v1/admin/finance/tax-settings` when `updateBookingTaxSettings` is supplied
- `POST /v1/admin/bookings/tax-preview`

Tax settings sit on the finance admin surface (alongside tax regimes, policy
rules, and invoice-fx) so the managed runtime's per-unit, prefix-first-match
admin dispatch does not let the bookings `GET /{id}` route swallow
`/tax-settings`. The preview endpoint is consumed by
`@voyant-travel/bookings-react` tax-preview
hooks. Consumers that use the booking-create dialog without mounting the route
will silently lose tax rows in the dialog summary because the client treats a
missing preview as "no tax to show".

Server-side booking-finalize code can use the same helpers directly:

```typescript
import {
  computeBookingItemTaxLine,
  loadProductTaxFacts,
  resolveBookingSellTaxRate,
} from "@voyant-travel/finance/booking-tax"
```

## Invoice FX Settings

Invoice issuing can enrich `invoice.issued` events with operator accounting
currency, FX rate, FX commission, and effective provider rate. Configure the
finance module with `invoiceFxSettings` or `resolveInvoiceFxSettings`, plus an
exchange-rate resolver:

```typescript
import {
  createFinanceApiModule,
  createVoyantDataFxExchangeRateResolver,
} from "@voyant-travel/finance"

createFinanceApiModule({
  invoiceFxSettings: {
    baseCurrency: "RON",
    fxCommissionBps: 200,
    fxCommissionInvoiceMention: "2% comision curs risc valutar",
  },
  resolveInvoiceExchangeRate: createVoyantDataFxExchangeRateResolver({
    apiKey: process.env.VOYANT_DATA_API_KEY!,
  }),
})
```

The default data resolver uses `@voyant-travel/data-sdk` to call the Voyant Data FX
pair route `/data/fx/v1/fx/pair/{invoiceCurrency}/{baseCurrency}`. SDK
responses can add provenance metadata such as `source`, `quotedAt`, and
`validUntil`; invoice-issued events expose those as `fxRateSource`,
`fxRateQuotedAt`, and `fxRateValidUntil`. If the invoice currency matches the
operator base currency, no FX fields are emitted.

The same resolver also backs `GET /v1/finance/invoice-fx-rate`, which lets
operator UI surfaces auto-fill cross-currency payment rates without exposing
the Voyant Cloud API key to the browser.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./invoice-fx` | Invoice FX settings, route helpers, and data FX resolver |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./booking-tax` | Booking sell-side tax policy helpers and route mounting |
| `./routes` | Hono routes |

## License

Apache-2.0
