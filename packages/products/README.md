# @voyantjs/products

Products module for Voyant. OCTO-aligned catalog with products, days, services, versions, and notes. Person/organization associations use link tables from the CRM module (no FK columns on products).

## Install

```bash
pnpm add @voyantjs/products
```

## Usage

```typescript
import { productsModule } from "@voyantjs/products"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [productsModule],
  // ...
})
```

## Entities

- **Products** (`prod`)
- **Product days** (`pday`)
- **Product day services** (`pdse`)
- **Product versions** (`pver`)
- **Product notes** (`prnt`)

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export + `productLinkable` |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |
| `./jobs` | Background jobs (PDF generation, etc.) |

## License

Apache-2.0
