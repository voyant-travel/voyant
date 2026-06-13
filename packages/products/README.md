# @voyantjs/products

Compatibility entrypoint for Voyant operated Product inventory.

The implementation now lives under `@voyantjs/inventory`. Existing
`@voyantjs/products` imports remain supported for v1 compatibility, including
the schema manifest path used by templates that still name
`@voyantjs/products/schema`. New operated-authoring code should import from
`@voyantjs/inventory`.

## Install

```bash
pnpm add @voyantjs/products
```

## Usage

```typescript
import { inventoryHonoModule } from "@voyantjs/inventory"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [inventoryHonoModule],
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
| `.` | Compatibility exports over `@voyantjs/inventory` |
| `./schema` | Compatibility schema shim over `@voyantjs/inventory/schema` |
| `./validation` | Compatibility validation shim |
| `./routes` | Compatibility Hono route shim |
| `./tasks` | Compatibility task shim |

## License

Apache-2.0
