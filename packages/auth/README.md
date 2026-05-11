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
import { createBetterAuth, handleApiTokenManagementRequest } from "@voyantjs/auth/server"

const auth = createBetterAuth({
  db,
  secret: env.AUTH_SECRET,
  trustedOrigins: ["https://example.com"],
})

const tokenResponse = await handleApiTokenManagementRequest(request, auth)
if (tokenResponse) return tokenResponse

return auth.handler(request)
```

Auth provider wiring is template-owned — core Voyant packages only depend on
the normalized `{ userId, actor }` contract, not on Better Auth specifically.

The package also exposes a narrow shared-secret bearer-token helper surface via
`@voyantjs/utils/session-claims` for runtime-local verification. That helper is
not a replacement for Better Auth session cookies and does not imply a
platform-wide JWKS/JWT-first auth model.

## API Token Management

Better Auth's API Key plugin owns token storage and verification. Voyant adds a
small `/auth/api-tokens` facade for operator management UI because the UI needs
server-only plugin fields such as `permissions`, `remaining`, and `enabled`.
Mount `handleApiTokenManagementRequest(...)` before falling through to
`auth.handler(request)`.

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
