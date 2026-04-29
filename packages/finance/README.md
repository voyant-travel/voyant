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

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0
