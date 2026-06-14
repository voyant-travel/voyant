# @voyant-travel/hono

Hono transport adapter for Voyant. Provides `createApp()`, middleware, auth
helpers, and plugin expansion for mounting Voyant modules behind a Hono app.

## Install

```bash
pnpm add @voyant-travel/hono hono
```

## Usage

```typescript
import { createApp } from "@voyant-travel/hono"

const app = createApp({
  db: (env) => getDb(env),
  auth: { handler, resolve },
  modules: [crmModule, productsModule, bookingsModule],
  extensions: [smartbillFinanceExtension],
  plugins: [
    payloadCmsPlugin({
      /* optional distribution bundle */
    }),
  ],
})
```

Use `modules`, `extensions`, and provider-backed route helpers as the default
composition surface. Use `plugins` when you want to register a reusable
distribution bundle that packages those pieces together.

The middleware chain is: container → requestId → logger → errorBoundary → CORS → health → auth handler → requireAuth → db → actor guards → module routes.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./app` | `createApp` factory |
| `./module` | `HonoModule`, `HonoExtension` contracts |
| `./plugin` | `HonoPlugin`, `defineHonoPlugin`, `expandHonoPlugins` |
| `./middleware` | All middleware re-exports |
| `./middleware/auth` | `requireAuth` session/API-key/JWT auth |
| `./middleware/cors` | CORS configuration |
| `./middleware/error-boundary` | Error handling + JSON error envelope |
| `./middleware/db` | Attach db client to `c.var.db` |
| `./middleware/rate-limit` | KV-backed rate limiter |
| `./middleware/require-actor` | Enforce `staff`/`customer`/`partner`/`supplier` actor |
| `./middleware/require-permission` | Permission-based guards |
| `./middleware/logger` | Request logger |
| `./auth/session-jwt` | `verifySession` shared-secret bearer/session-claims verification |
| `./auth/crypto` | `sha256Base64Url`, cookie helpers |

## License

Apache-2.0
