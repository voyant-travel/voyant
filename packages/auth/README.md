# @voyantjs/auth

Better Auth wiring for Voyant's reference template stack. Provides server-side
auth helpers, edge runtime variants, backend utilities, and a permissions
contract.

## Install

```bash
pnpm add @voyantjs/auth better-auth
```

## Usage

```typescript
import { createAuth } from "@voyantjs/auth/server"

const auth = createAuth({
  database: db,
  secret: env.AUTH_SECRET,
  trustedOrigins: ["https://example.com"],
})
```

Auth provider wiring is template-owned — core Voyant packages only depend on
the normalized `{ userId, actor }` contract, not on Better Auth specifically.

The package also exposes a narrow shared-secret bearer-token helper surface via
`@voyantjs/utils/session-claims` for runtime-local verification. That helper is
not a replacement for Better Auth session cookies and does not imply a
platform-wide JWKS/JWT-first auth model.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./server` | Node.js/server `createAuth` factory |
| `./edge` | Edge/Workers `createAuth` factory |
| `./backend` | Backend helpers (session inspection, API keys) |
| `./permissions` | Permission/role contracts |

## License

Apache-2.0
