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
import {
  createBetterAuth,
  handleAccountProfileRequest,
  handleApiTokenManagementRequest,
} from "@voyantjs/auth/server"

const auth = createBetterAuth({
  db,
  secret: env.AUTH_SECRET,
  trustedOrigins: ["https://example.com"],
  user: {
    additionalFields: {
      surfaces: {
        type: "string",
        required: false,
      },
    },
  },
})

const profileResponse = await handleAccountProfileRequest(request, auth, { db })
if (profileResponse) return profileResponse

const tokenResponse = await handleApiTokenManagementRequest(request, auth)
if (tokenResponse) return tokenResponse

return auth.handler(request)
```

Auth provider wiring is template-owned — core Voyant packages only depend on
the normalized `{ userId, actor }` contract, not on Better Auth specifically.

`createBetterAuth` forwards Better Auth's `user` options, including
`user.additionalFields`, while preserving Voyant's default change-email support.
When using additional user fields with the Drizzle adapter, the consuming app is
responsible for adding matching columns and migrations to the auth user table.

Better Auth server plugins that define their own tables must pass those Drizzle
tables through `extraSchema` so the shared Drizzle adapter can resolve them:

```typescript
import { createBetterAuth } from "@voyantjs/auth/server"
import { authInvitation, authMember, authOrganization } from "@voyantjs/db/schema/iam"
import { organization } from "better-auth/plugins"

const auth = createBetterAuth({
  db,
  plugins: [organization()],
  extraSchema: {
    organization: authOrganization,
    member: authMember,
    invitation: authInvitation,
  },
})
```

The app that mounts the plugin owns the plugin migrations. `extraSchema` only
connects existing Drizzle table definitions to Better Auth; it does not create
or run migrations.

The package also exposes a narrow shared-secret bearer-token helper surface via
`@voyantjs/utils/session-claims` for runtime-local verification. That helper is
not a replacement for Better Auth session cookies and does not imply a
platform-wide JWKS/JWT-first auth model.

## Voyant Cloud Admin Auth

Voyant Cloud deployments can use `@voyantjs/auth/cloud-admin-session` to keep
Better Auth as the local session and JWT/JWKS issuer while delegating identity
and membership checks to Voyant Cloud.

```typescript
import { createVoyantCloudAdminAuthPlugin } from "@voyantjs/auth/cloud-admin-session"
import { createBetterAuth } from "@voyantjs/auth/server"

const auth = createBetterAuth({
  db,
  basePath: "/auth",
  plugins: [
    createVoyantCloudAdminAuthPlugin({
      db,
      cookieSecret: env.SESSION_CLAIMS_SECRET,
      exchange: {
        exchangeUrl: env.VOYANT_CLOUD_ADMIN_AUTH_EXCHANGE_URL,
        deploymentId: env.VOYANT_CLOUD_DEPLOYMENT_ID,
        clientToken: env.VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN,
        assertionJwksUrl: env.VOYANT_CLOUD_ADMIN_AUTH_JWKS_URL,
        assertionAudience: env.VOYANT_CLOUD_ADMIN_AUTH_AUDIENCE ?? env.VOYANT_CLOUD_DEPLOYMENT_ID,
      },
      onUserProvisioning: async ({ db, assertion, user, isNewUser }) => {
        // Optional Cloud-mode side effects or app-owned profile/user columns.
        // Better Auth databaseHooks.user.create.* do not fire for this trusted
        // mirror path because it bypasses public sign-up.
      },
    }),
  ],
})
```

The plugin mounts Better Auth's `/auth/cloud/callback` endpoint. That endpoint
validates the signed broker state, exchanges the one-time Cloud code, verifies
the signed Cloud assertion, upserts the local mirror user/account/profile,
stores Cloud linkage side-table rows, and then creates the local Better Auth
session cookie through Better Auth's own session and cookie helpers.

Cloud mode is intentionally a direct mirror provisioning path, similar to a
trusted invitation redemption path. Consumer Better Auth
`databaseHooks.user.create.*` are not invoked. Use `onUserProvisioning` for
Cloud-mode custom fields or side effects.

## API Token Management

Better Auth's API Key plugin owns token storage and verification. Voyant adds a
small `/auth/api-tokens` facade for operator management UI because the UI needs
server-only plugin fields such as `permissions`, `remaining`, and `enabled`.
Mount `handleApiTokenManagementRequest(...)` before falling through to
`auth.handler(request)`.

## Account Profile

Voyant auth UIs use `PATCH /auth/me` to update the signed-in user's basic
profile fields: `firstName`, `lastName`, `locale`, `timezone`, and
`profilePictureUrl`. Mount `handleAccountProfileRequest(...)` before falling
through to `auth.handler` when the app wants shared onboarding or account UI to
submit directly to the auth facade.

`updateCurrentUserProfile(db, { userId, ...patch })` from
`@voyantjs/auth/workspace` updates the Voyant profile row and returns the
normalized `CurrentUser`.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./server` | Node.js/server `createAuth` factory |
| `./edge` | Edge/Workers `createAuth` factory |
| `./backend` | Backend helpers (session inspection, API keys) |
| `./cloud-admin-session` | Better Auth plugin for Voyant Cloud broker callbacks |
| `./cloud-broker` | Browser state and assertion exchange helpers for the Cloud broker |
| `./workspace` | Current-user/profile helpers for mounted auth routes |
| `./permissions` | Permission/role contracts |

## License

Apache-2.0
