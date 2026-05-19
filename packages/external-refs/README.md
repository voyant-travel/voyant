# @voyantjs/external-refs

External references module for Voyant. Cross-system external identity and
mapping layer - correlates Voyant entities with IDs in third-party systems such
as channels, supplier systems, bedbanks, GDSs, PMSs, and OTAs.

External refs are cross-cutting integration support for the target OTA,
tour-operator, and DMC scenarios.

## Install

```bash
pnpm add @voyantjs/external-refs
```

## Usage

```typescript
import { externalRefsModule } from "@voyantjs/external-refs"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [externalRefsModule],
  // ...
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0
