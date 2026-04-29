# @voyantjs/legal

Legal module for Voyant. Contracts and policies in a single package — templates with variable substitution, versioning, number series, signing workflow, structured cancellation/payment/T&C policies with rule evaluation, assignments, and acceptance tracking.

## Install

```bash
pnpm add @voyantjs/legal
```

## Usage

```typescript
import { legalHonoModule } from "@voyantjs/legal"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [legalHonoModule],
  // ...
})
```

## Entities

### Contracts

- **Contracts** (`cont`) — legal document instances with status lifecycle
- **Contract templates** (`ctpl`) — reusable templates with variable schemas
- **Contract template versions** (`ctpv`) — immutable version snapshots
- **Contract signatures** (`ctsi`) — signing records (who/when/method/ip)
- **Contract number series** (`ctns`) — series definitions with auto-increment
- **Contract attachments** (`ctat`) — rendered PDFs and appendices

### Policies

- **Policies** (`pol`) — policy definitions by kind (cancellation, payment, T&C, etc.)
- **Policy versions** (`plvr`) — immutable version snapshots with publish/retire lifecycle
- **Policy rules** (`plrl`) — structured rules per version (cancellation windows, percentages)
- **Policy assignments** (`plas`) — scope-based assignment to products, channels, markets
- **Policy acceptances** (`plac`) — acceptance records per booking/order/person

## Exports

| Entry | Description |
| --- | --- |
| `.` | Combined module export + all linkable definitions |
| `./contracts` | Contract barrel (types, tables, service, validation) |
| `./contracts/schema` | Drizzle tables for contracts |
| `./contracts/validation` | Zod schemas for contracts |
| `./contracts/routes` | Hono routes for contracts (admin + public) |
| `./contracts/service` | Contract service functions |
| `./policies` | Policy barrel (types, tables, service, validation) |
| `./policies/schema` | Drizzle tables for policies |
| `./policies/validation` | Zod schemas for policies |
| `./policies/routes` | Hono routes for policies (admin + public) |
| `./policies/service` | Policy service functions |

## License

Apache-2.0
