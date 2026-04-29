# @voyantjs/next

Next.js route adapter helpers for Voyant. Mount Voyant modules in-process from Next.js route handlers — an alternative to running Voyant as a separate Hono server.

## Install

```bash
pnpm add @voyantjs/next
```

## Usage

```typescript
// app/api/v1/[...voyant]/route.ts
import { createVoyantRoute } from "@voyantjs/next/route"
import { crmModule, productsModule } from "..."

const handler = createVoyantRoute({
  modules: [crmModule, productsModule],
  db: () => getDb(),
  auth: { handler, resolve },
})

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./route` | `createVoyantRoute` route-handler factory |
| `./responses` | JSON response helpers |
| `./types` | Route handler types |

## License

Apache-2.0
