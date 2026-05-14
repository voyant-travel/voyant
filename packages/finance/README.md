# @voyantjs/finance

Finance module for Voyant. Invoices, payments, credit notes, supplier payments, and finance notes.

## Install

```bash
pnpm add @voyantjs/finance
```

## Usage

```typescript
import { financeModule } from "@voyantjs/finance"
import { createApp } from "@voyantjs/hono"

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

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0
