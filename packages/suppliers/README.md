# @voyantjs/suppliers

Suppliers module for Voyant. Models suppliers, their services, rate cards, and notes.

## Install

```bash
pnpm add @voyantjs/suppliers
```

## Usage

```typescript
import { suppliersModule } from "@voyantjs/suppliers"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [suppliersModule],
  // ...
})
```

## Entities

- **Suppliers** (`supp`)
- **Supplier services** (`ssvc`)
- **Supplier rates** (`srat`)
- **Supplier notes** (`snot`)

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export + public types |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0
