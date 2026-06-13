# @voyantjs/suppliers

Compatibility facade. Supplier runtime implementation now lives under
`@voyantjs/distribution/suppliers`; keep this package only for existing imports
until the v1 public-name policy removes or formally deprecates it.

Suppliers module for Voyant. Models suppliers, their services, rate cards, and
notes for OTA, tour-operator, and DMC workflows.

Suppliers are ecosystem counterparties and operating parties. They are not a
separate Voyant implementation scenario.

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

New first-party code should import from `@voyantjs/distribution/suppliers`.

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
