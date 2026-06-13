# @voyantjs/ground

Compatibility facade for Operations ground logistics.

New code should import `@voyantjs/operations/ground`. This package keeps
existing `@voyantjs/ground` imports and schema metadata working while the v1
package move lands.

Ground supports transfers, pickups, dropoffs, dispatch, and local logistics for
the target OTA, tour-operator, and DMC scenarios.

## Install

```bash
pnpm add @voyantjs/operations
```

## Usage

```typescript
import { groundModule } from "@voyantjs/operations/ground"
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
| `.` | Compatibility re-export of `@voyantjs/operations/ground` |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0
