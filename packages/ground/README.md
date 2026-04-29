# @voyantjs/ground

Ground transport module for Voyant. Operators, vehicles, drivers, transfer preferences, dispatch, and execution — a full operational layer for ground-transport workflows.

## Install

```bash
pnpm add @voyantjs/ground
```

## Usage

```typescript
import { groundModule } from "@voyantjs/ground"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [groundModule],
  // ...
})
```

## Entities

- **Operators** (`gopr`), **Vehicles** (`gveh`), **Drivers** (`gdrv`)
- **Transfer preferences** (`gtpr`)
- **Dispatch** (`gdsp`), **Execution** (`gexe`)
- **Assignments** (`gdas`), **Logs** (`gdlg`)
- **Positions** (`gdps`), **Shifts** (`gdsh`), **Signals** (`gsin`), **Comps** (`gdcp`)

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0
