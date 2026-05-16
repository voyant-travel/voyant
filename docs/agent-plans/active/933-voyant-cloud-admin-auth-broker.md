# Issue 933: Voyant Cloud Admin Auth Broker Plan

## Context

Issue: https://github.com/voyantjs/voyant/issues/933

Goal: Cloud-hosted Voyant admin panels should let users sign in with their
existing Voyant Cloud account, while self-hosted installs keep the current
local Better Auth sign-in, sign-up, invitation, and account-management flows.
First-party templates should assume Voyant Cloud deployment as the primary path
and ship prewired for Voyant Cloud auth, with local auth kept as an explicit
self-host/development mode.

The preferred architecture is a Voyant Cloud identity broker rather than direct
WorkOS AuthKit configuration in every tenant admin deployment.

Important follow-up from the issue comment: Cloud mode must not bypass Better
Auth entirely inside the admin deployment. Some consumers already mount Better
Auth plugins such as `jwt()` and rely on `/auth/token` plus `/auth/jwks` so a
separate CMS or other relying party can verify admin-issued JWTs. Consumers also
use `user.additionalFields` and `extraSchema` from `@voyantjs/auth` 0.50.5.

Therefore the target architecture is:

- Voyant Cloud owns WorkOS identity and membership verification.
- The admin deployment owns a local Better Auth mirror user and local Better
  Auth session.
- Both `local` and `voyant-cloud` auth modes preserve the same local Better Auth
  plugin surface where the consuming app has opted into it.

## Source Findings

### Voyant Auth

- `packages/hono` already accepts app-provided `auth.resolve(...)` and expects a
  normalized `VoyantRequestAuthContext`.
- `templates/operator/src/api/auth/handler.ts` currently builds Better Auth per
  request and exposes `/auth/me`, `/auth/status`, `/auth/bootstrap-status`,
  Better Auth catch-all routes, and API token facade routes.
- `packages/auth/src/server.ts` already forwards Better Auth `user` options and
  merges `extraSchema` into the Drizzle adapter schema.
- `packages/auth/README.md` documents that consumers own migrations for
  additional user fields and plugin tables.
- Current admin architecture says the base admin shell should bootstrap from a
  current-user primitive only; organization/team state should not become a shell
  prerequisite.

### Voyant Cloud

- `voyant-cloud/apps/dash` uses `@workos/authkit-tanstack-react-start`.
- `voyant-cloud/apps/api/src/platform/workos-auth.ts` validates WorkOS access
  tokens, gets the WorkOS user, lists active organization memberships, and builds
  platform `AuthContext`.
- `voyant-cloud/packages/db/src/schema/organizations.ts` stores platform
  organizations, organization identities, and organization memberships.
- Cloud already has the pieces needed to map WorkOS organization membership to a
  platform organization and deployment.

### Better Auth Docs Checked

- `https://better-auth.com/llms.txt`
- `https://better-auth.com/llms.txt/docs/plugins/jwt.md`
- `https://better-auth.com/llms.txt/docs/concepts/database.md`
- `https://better-auth.com/llms.txt/docs/concepts/hooks.md`
- `https://better-auth.com/llms.txt/docs/concepts/session-management.md`
- `https://better-auth.com/llms.txt/docs/plugins/one-time-token.md`
- `https://better-auth.com/llms.txt/docs/plugins/generic-oauth.md`

Relevant conclusions:

- The Better Auth JWT plugin is not a session replacement. It is a relying-party
  token layer for services that cannot use the session.
- The JWT plugin exposes `/token` and `/jwks`; relying parties verify JWTs using
  JWKS and should be able to cache keys until a new `kid` appears.
- Better Auth supports `user.additionalFields` for custom user columns.
- Better Auth supports plugin tables and schemas; with Drizzle, the app must own
  the migrations and schema definitions.
- Database hooks exist for core user/session/account lifecycle events, but a raw
  admin-side mirror upsert would not automatically run consumer hooks unless the
  Voyant auth layer deliberately preserves that contract.
- Better Auth has a one-time-token plugin for cross-domain session transfer, but
  it attaches tokens to an existing Better Auth session. It is useful as a
  design reference for short-lived, single-use, hashed token storage, not as the
  Cloud broker mechanism by itself.

## Non-Negotiable Constraints

1. Auth mode is deployment-level, not per-user.
2. First-party templates are Cloud-first: generated Cloud deployments should be
   prewired for `voyant-cloud` auth without app authors hand-editing auth
   plumbing.
3. `local` remains the self-host-safe and local-development mode.
4. `voyant-cloud` requires Voyant Cloud configuration and must fail closed if
   that configuration is missing or invalid.
5. `voyant-cloud` is exclusive. When a deployment is in Cloud mode, local
   credential sign-in, sign-up, invitation redemption, password reset, local
   social OAuth, and local break-glass auth are not available. Localhost uses
   the separate `local` mode.
6. Localhost/local development must still allow full local Better Auth
   workflows without requiring Voyant Cloud or WorkOS.
7. Domain packages must keep consuming only provider-neutral
   `VoyantRequestAuthContext`.
8. WorkOS user IDs, WorkOS org IDs, and platform organization IDs must not leak
   into domain modules.
9. Existing `createBetterAuth` options, especially `user.additionalFields`,
   `plugins`, and `extraSchema`, must stay available in both modes.
10. If the consuming app mounts Better Auth `jwt()`, both auth modes must be able
   to issue verifiable JWTs through the same local `/auth/token` and `/auth/jwks`
   endpoints.
11. Consumer-owned user columns must have a provisioning seam in Cloud mode.
12. Consumer Better Auth `databaseHooks.user.create.*` do not fire for Cloud
   mirror provisioning. Cloud mirror provisioning is a trusted server-side path
   that bypasses public sign-up; the documented cloud-mode equivalent is
   `onCloudUserProvisioning`, and consumers must move Cloud-mode provisioning
   side effects there.
13. The grant exchange must be server-to-server and one-time-use.
14. Cloud mode must use an auth route allowlist, not a Better Auth route
    denylist.
15. Personal API tokens owned by a Cloud-mirrored user must be disabled or
    rejected when that user's Cloud membership is revoked.
16. Cloud mirror provisioning must bypass the public local sign-up guard while
    sharing local profile provisioning and Cloud provisioning hooks.
17. Local Better Auth session issuance must go through a narrow Better
    Auth-backed helper/endpoint, not hand-rolled session rows and cookie
    attributes in a plain Hono route.
18. Cloud linkage metadata belongs in a side table keyed by local user/session,
    not in the Better Auth session response shape.
19. Cloud must validate app-level access scope as well as organization
    membership.
20. The exchange response is a short-lived signed JWS. "Authenticated JSON" is
    not an alternative for the user assertion.

## Target Architecture

### Auth Modes

Introduce a deployment-level auth mode:

```ts
type OperatorAuthMode = "local" | "voyant-cloud"
```

Suggested environment variable:

```text
VOYANT_ADMIN_AUTH_MODE=local | voyant-cloud
```

Mode behavior:

- `voyant-cloud`: default for Voyant Cloud-provisioned first-party template
  deployments. Sign-in and team membership are brokered through Voyant Cloud,
  then mirrored into local Better Auth so the admin deployment still has local
  sessions, local profile/preferences, and optional plugin behavior. This mode
  is exclusive: browser-facing local identity flows are disabled server-side.
- `local`: explicit self-host/development mode. Current Better Auth behavior.
  Local sign-in, sign-up, invitations, email OTP, password reset, profile, API
  token facade, and optional Better Auth plugins continue to work.

Template wiring should make the Cloud path the out-of-the-box production
experience for deployments created by Voyant Cloud. Self-hosters and localhost
development should be able to select local auth through documented
environment/config values without removing Cloud-specific code by hand.

### Implementation Slice 1 Status

Implemented in `issue-933-cloud-auth-broker`:

- `templates/operator` and `templates/dmc` now have
  `VOYANT_ADMIN_AUTH_MODE`, defaulting to `local` in template config so
  localhost and self-hosted development keep the current Better Auth behavior.
- Operator auth routes now fail closed in `voyant-cloud` mode:
  - `GET /auth/bootstrap-status` returns `hasUsers: true` and does not route a
    Cloud deployment into local bootstrap sign-up.
  - `GET /auth/cloud/start` and `GET /auth/cloud/callback` exist as Cloud-mode
    broker placeholders and return `501` until the Cloud broker is wired.
  - The Better Auth catch-all delegates only the explicit Cloud-mode allowlist:
    `/auth/get-session`, `/auth/session`, `/auth/sign-out`, `/auth/token`, and
    `/auth/jwks`.
  - Local credential sign-in, sign-up, password reset, email OTP, local Google
    OAuth, and other Better Auth identity mutation endpoints return `404` in
    Cloud mode.
  - API token management returns `501` in Cloud mode until Cloud membership
    revalidation and revocation handling are implemented, avoiding an unsafe
    partial state where personal tokens outlive Cloud membership.
- Local auth screens now respect Cloud mode. Sign-in, sign-up, verify-email,
  forgot-password, reset-password, and accept-invitation loaders redirect to
  `/api/auth/cloud/start` instead of rendering local forms when
  `authMode: "voyant-cloud"` comes back from bootstrap status.
- DMC now has the same Cloud-mode route boundary and local auth screen
  redirects as operator. It does not expose an API-token facade today, so the
  API-token revalidation work applies to operator first.
- `@voyantjs/auth/workspace` now exposes shared profile provisioning helpers.
  Local Better Auth sign-up hooks and the operator `/auth/status` fallback use
  the same profile creation path. Future Cloud mirror provisioning should call
  this helper plus the documented Cloud provisioning hook rather than relying on
  consumer Better Auth `databaseHooks.user.create.*`.
- IAM schema now has Cloud-linkage side tables for local mirror users and
  sessions, plus a unique `(provider_id, account_id)` constraint on Better Auth
  accounts. Operator and DMC migrations create those tables/indexes so future
  exchange/revalidate code has a typed place to store WorkOS/platform linkage
  without leaking it through Better Auth's session response.
- `@voyantjs/auth/cloud-broker` now centralizes the admin-owned browser state
  for the broker redirect. It creates a signed, HttpOnly, short-lived state
  cookie, generates state/nonce values, normalizes the post-login `next`
  destination to same-origin paths, builds the Voyant Cloud dashboard
  `/admin-auth/start` redirect, and verifies callback state before any exchange
  code may run.
- Operator and DMC `/auth/cloud/start` now perform the real broker redirect
  when `VOYANT_CLOUD_ADMIN_AUTH_START_URL` and `VOYANT_CLOUD_DEPLOYMENT_ID` are
  configured. `/auth/cloud/callback` validates state and clears the state cookie,
  then still returns `501` because signed assertion exchange and Better
  Auth-backed local session issuance are intentionally not implemented yet.
- Template env docs now include the Cloud-injected broker settings:
  `VOYANT_CLOUD_ADMIN_AUTH_START_URL`, `VOYANT_CLOUD_DEPLOYMENT_ID`,
  `VOYANT_CLOUD_APP_ID`, and `VOYANT_CLOUD_ENVIRONMENT`.

### Broker Flow

```text
Browser opens admin
Admin sees VOYANT_ADMIN_AUTH_MODE=voyant-cloud
Admin creates state + nonce and redirects to Voyant Cloud dashboard broker start
Voyant Cloud dashboard uses existing WorkOS AuthKit session or prompts sign-in
Voyant Cloud API resolves target deployment and validates callback URI
Voyant Cloud verifies active WorkOS membership in owning platform organization
Voyant Cloud stores a short-lived, hashed, one-time grant
Voyant Cloud dashboard redirects back to admin callback with code + state
Admin backend validates state and exchanges code server-to-server
Voyant Cloud API atomically consumes grant and returns signed JWS assertion
Admin backend verifies assertion response
Admin backend upserts local Better Auth mirror user/account/profile
Admin backend creates local Better Auth session cookie through a Better
  Auth-backed session issuance helper
Admin shell reads /auth/me
Admin APIs resolve local Better Auth session into VoyantRequestAuthContext
Optional relying parties call local /auth/token and /auth/jwks
```

### Why Keep Better Auth In Cloud Mode

Cloud identity answers who the user is and whether the user may access the
deployment. Better Auth remains the admin deployment's local session and
relying-party token issuer.

This keeps existing consumers working:

- Payload or CMS surfaces can continue verifying admin-issued JWTs against
  local `/auth/jwks`.
- `jwt()` remains a local plugin concern.
- `apiKey()` remains a local admin API token concern.
- Consumer-owned `user.additionalFields` remain local schema extensions.
- Consumer-owned plugin tables remain wired through `extraSchema`.

## Cloud-Side Design

### Endpoints

Names are tentative.

```text
GET  /admin-auth/start
GET  /admin-auth/callback
```

`voyant-cloud/apps/dash` owns the interactive browser portion because it already
owns the WorkOS AuthKit browser/session integration. The dashboard start route
uses `getAuth()`/AuthKit middleware, prompts sign-in when needed, then calls the
Cloud API to issue a grant.

Cloud API endpoints:

```text
POST /dashboard/v1/admin-auth/grants
POST /dashboard/v1/admin-auth/exchange
POST /dashboard/v1/admin-auth/revalidate
```

`start` accepts:

- target deployment id
- target app/environment identifier
- admin callback URL, full URI
- state
- nonce
- optional requested surface, e.g. `admin`

`exchange` accepts:

- one-time code
- deployment id
- callback URI
- nonce or nonce hash

`revalidate` accepts:

- deployment id
- external user id
- current local session id or cloud subject

### Grant Storage

Use a Cloud-side table or durable storage for admin auth grants:

- `id`
- `hashed_code`
- `platform_organization_id`
- `workos_organization_id`
- `workos_user_id`
- `deployment_id`
- `app_id`
- `environment`
- `redirect_origin`
- `redirect_uri`
- `state_hash`
- `nonce_hash`
- `expires_at`
- `consumed_at`
- `created_at`

Security properties:

- 128-bit or stronger random code.
- Hash stored code; plaintext only appears in the redirect.
- TTL 30-120 seconds.
- Atomic consume on exchange.
- Replay returns 401/409 and is audit-worthy.
- Code is bound to deployment, full redirect URI, and nonce.
- Full redirect URI must come from Cloud deployment/app/release metadata, not
  user input. Validating only origin is insufficient.

### Assertion Payload

Cloud returns a short-lived signed JWS assertion with `kid` and at least:

```ts
type CloudAdminAssertion = {
  iss: "https://api.voyantjs.com"
  aud: string // admin deployment id or configured audience
  sub: string // stable WorkOS user id
  email: string
  emailVerified: boolean
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  image?: string | null
  workosUserId: string
  workosOrganizationId: string
  platformOrganizationId: string
  platformOrganizationSlug: string
  deploymentId: string
  appId?: string | null
  environment?: string | null
  membershipId?: string | null
  roleSlug?: string | null
  roleName?: string | null
  surfaces?: string[] | null
  nonce: string
  iat: number
  exp: number
}
```

The admin deployment should treat this assertion as input to local
provisioning, not as the long-lived session.

The admin deployment must verify the issuer against one configured value. Do not
accept an arbitrary issuer from configuration or payload.

The admin deployment's exchange and revalidate calls should also authenticate as
the target deployment using server-to-server credentials. This is separate from
the signed user assertion: deployment authentication says "this admin app may
call Cloud"; the JWS says "Cloud verified this user for this deployment."

### Membership Rules

Cloud must verify:

- WorkOS user exists.
- WorkOS membership is active.
- Membership's WorkOS organization maps to the platform organization that owns
  the target deployment.
- Any Cloud app-level scope allows the user to access this app. This includes
  existing platform membership scope such as `organization_memberships.scope_app_ids`
  where configured.
- Platform organization is active.
- Deployment/app/environment is active and belongs to that platform
  organization.
- Requested redirect URI exactly matches a Cloud-owned callback URI derived from
  app/deployment/release/custom-hostname metadata.

If membership is missing or inactive, Cloud should redirect back to the admin
callback with an opaque error such as `error=no_access` rather than rendering a
Cloud-side 403. This keeps the UX inside the admin shell and avoids revealing
deployment existence to unauthorized users.

Platform admins may need a support bypass later, but it should be explicit and
audited. It should not be part of the first implementation unless required.

## Admin-Side Design

### Template Defaults

First-party templates should be generated with Cloud auth plumbing already in
place:

- Cloud deployments set `VOYANT_ADMIN_AUTH_MODE=voyant-cloud`.
- Cloud provisioning injects required broker settings such as deployment id,
  broker base URL, assertion issuer/audience, and server-to-server credentials.
- Local development and self-host examples set `VOYANT_ADMIN_AUTH_MODE=local`.
- The sign-in UI should prefer "Sign in with Voyant Cloud" when mode is
  `voyant-cloud` and should show local Better Auth forms only in `local` mode.
- Template authors should not need to choose between separate auth handler
  implementations. The template should compose the same auth handler with a
  deployment-level mode switch.
- Cloud deployments must not present or accept a fallback local login path.
- Localhost development must keep all local Better Auth workflows available so
  developers can work without Voyant Cloud credentials or network dependency.

### Routes

In `voyant-cloud` mode, the admin auth handler should expose:

```text
GET  /auth/cloud/start
GET  /auth/cloud/callback
POST /auth/cloud/revalidate
POST /auth/sign-out or existing sign-out path
GET  /auth/me
GET  /auth/status
```

Better Auth should remain available behind an explicit Cloud-mode route
allowlist for plugin endpoints that still matter, especially:

```text
/auth/session
/auth/get-session
/auth/token
/auth/jwks
/auth/api-tokens
```

Cloud mode must not expose Better Auth's full catch-all by default. It should
use an explicit allowlist for Better Auth-backed endpoints that are still local
deployment responsibilities:

- session read/refresh endpoints needed by the admin client
- sign-out/session revoke endpoints
- JWT plugin endpoints such as `/auth/token` and `/auth/jwks`
- API token facade routes, subject to Cloud membership revalidation rules
- narrowly approved plugin endpoints that do not mutate Cloud-owned identity

Cloud mode must block Better Auth endpoints that mutate local identity truth
independently from WorkOS/Voyant Cloud, including:

- sign-up
- email/password sign-in
- forgot password
- reset password
- change email
- email verification
- email OTP send/verify
- local social OAuth such as Google
- invitation accept/redeem flows that create local users outside Cloud

This should be implemented as an allowlist because Better Auth and plugins can
add routes over time.

Do not treat hidden UI as enforcement. In Cloud mode these endpoints must be
blocked server-side. In `local` mode, including localhost development, the same
endpoints remain available according to the current Better Auth setup.

### Better Auth Mirror

After a successful Cloud assertion exchange, the admin backend should upsert a
local Better Auth user and account-like identity row.

Stable identity:

- local `auth.user.id`: generated locally on first mirror creation.
- local `auth.user.email`: latest Cloud/WorkOS email.
- local `auth.user.name`: latest display name.
- local `auth.user.image`: latest profile image.
- local account provider: `voyant-cloud`.
- local account provider account id: WorkOS user id.

Chosen strategy:

- Keep local `auth.user.id` generated by the admin deployment and stable after
  first mirror creation. JWT `sub` remains the local Better Auth user id.
- Add or reuse account mapping to hold `provider="voyant-cloud"` and
  `accountId=<workos user id>`.
- The account mapping must enforce uniqueness for `(provider, accountId)` or the
  Better Auth equivalent to prevent concurrent duplicate mirror users.
- If a deterministic account id is needed, derive it as a deployment-scoped HMAC
  of the WorkOS user id. Do not place raw WorkOS ids into local JWT `sub`.
- Do not expose WorkOS IDs through `VoyantRequestAuthContext`.
- This supports future WorkOS user merge/re-link without rewriting local JWT
  subjects for relying parties.

Better Auth may not expose a public API for "create this external user and
session from an already verified broker assertion" in exactly the shape needed
here. Add a narrow Voyant-owned provisioning helper/endpoint in
`@voyantjs/auth/server` that runs with Better Auth context rather than
hand-rolling session rows and cookies in the operator Hono route.

The helper should:

1. upserts the user and account rows,
2. runs the same profile provisioning side effects as local user creation,
3. invokes a documented `onCloudUserProvisioning` hook,
4. creates a local Better Auth-compatible session, and
5. returns the `Set-Cookie` response headers expected by the existing client.

The helper must bypass the public sign-up guard. The current Better Auth
`user.create.before` hook intentionally blocks public sign-up once a user
exists; Cloud mirror provisioning is a trusted server-side path and should
behave more like invitation redemption than public sign-up.

### Consumer-Owned Fields

Cloud mode needs a way to populate additional user fields such as:

```ts
user: {
  additionalFields: {
    surfaces: {
      type: "string",
      required: false,
      input: false,
    },
  },
}
```

Add an explicit provisioning seam:

```ts
type CloudUserProvisioningInput = {
  assertion: CloudAdminAssertion
  existingUser: CurrentBetterAuthUser | null
  defaultUserPatch: {
    email: string
    name: string
    image?: string | null
  }
}

type CloudUserProvisioningResult = {
  userPatch?: Record<string, unknown>
  profilePatch?: Record<string, unknown>
}
```

Possible API:

```ts
createBetterAuth({
  // existing options unchanged
  user: { additionalFields: { surfaces: { type: "string", required: false } } },
  extraSchema: { jwks },
  cloudProvisioning: {
    onUserProvisioning: async (input) => ({
      userPatch: {
        surfaces: input.assertion.surfaces?.join(",") ?? "admin",
      },
    }),
  },
})
```

The exact option name can change, but the contract must let consumers populate
their own columns without bypassing the broker or forking the handler.

### Database Hook Compatibility

Today `createBetterAuth` installs a `databaseHooks.user.create.after` hook that
creates `user_profiles` and marks the first user as super admin.

Cloud mirror provisioning must preserve Voyant's own profile invariant, but it
should not pretend that consumer Better Auth database hooks fired if the
implementation does direct mirror upserts.

Decision:

- The first implementation should use a direct, server-verified mirror upsert.
- Voyant-owned profile provisioning must be extracted and called from both local
  Better Auth user creation and Cloud mirror creation.
- Consumer-owned `databaseHooks.user.create.{before,after}` are local Better
  Auth lifecycle hooks and will not fire for Cloud mirror provisioning in this
  path.
- Add and document `onCloudUserProvisioning` as the Cloud-mode equivalent for
  consumer-owned additional fields and side effects.
- Tests must prove this behavior rather than relying on accidental hook
  execution.

If a future implementation can safely drive Better Auth's native user creation
path for broker assertions, this section can be revisited. Do not straddle both
stories in code.

Acceptance check:

- A consumer that relies on `user_profiles` existing after first sign-in should
  get the same row after a Cloud-authenticated first sign-in.
- A consumer that needs custom Cloud-mode user provisioning can populate
  `user.additionalFields` through `onCloudUserProvisioning`.
- Documentation clearly states that Better Auth `databaseHooks.user.create.*`
  are not invoked by direct Cloud mirror provisioning.

### JWT Relying Party Compatibility

If a consumer mounts `jwt()` and provides required plugin schema through
`extraSchema`, both modes must satisfy:

- `/auth/jwks` returns the local admin JWKS.
- `/auth/token` returns a JWT for the current local admin Better Auth session.
- JWT `sub` is stable across local session refreshes.
- The CMS/relying party does not need WorkOS knowledge.
- Cloud mode does not require the relying party to trust Voyant Cloud directly.

This should become an explicit test fixture.

## Session And Revocation

Local admin sessions should remain Better Auth sessions.

Recommended Cloud mode TTL:

- local session `expiresIn`: similar to local mode unless product decides
  shorter is required.
- Cloud membership revalidation: on session refresh, not on every request.
- Recommended initial max age: 15 minutes for Cloud-auth sessions, configurable
  per deployment.
- If revalidation fails, revoke the local session and return 401.
- V1 may be pull-only. A follow-up should add Cloud-to-admin webhook delivery
  for near-immediate membership revocation if the deployment has a reachable
  webhook endpoint.

Data to store in a local Cloud auth linkage side table:

- auth provider: `voyant-cloud`
- local user id
- local session id, nullable when recording user-level linkage
- WorkOS user id
- WorkOS organization id
- platform organization id
- deployment id
- last cloud revalidation time
- Cloud assertion id or broker session id, if issued

Do not add these fields directly to the Better Auth session response shape; they
could leak through `/auth/get-session` or client session helpers. Do not add
them to domain route context. Use them only inside auth middleware and
audit/auth tables.

### API Token Revocation

Personal API tokens created through the local Better Auth API key plugin can
outlive browser sessions. In Cloud mode this is an access-control risk: a user
removed from the owning WorkOS organization could lose their browser session
but keep using local admin API tokens.

Decision:

- API token verification in Cloud mode must check Cloud membership state for the
  token owner at the same revalidation cadence used for sessions, or use a
  cached membership status that is invalidated on revalidation failure.
- When a Cloud-auth session revalidation fails for a user, disable or revoke all
  personal API key rows owned by that local user unless the key is explicitly
  marked deployment/system-owned.
- The API token facade should expose revocation reason/audit metadata where the
  current schema supports it; otherwise add a follow-up schema migration.
- Acceptance tests must cover API token denial after Cloud membership
  revocation.

## Break-Glass Access

Cloud-hosted deployments should not mix Cloud and local auth. If
`VOYANT_ADMIN_AUTH_MODE=voyant-cloud`, Voyant Cloud is the only user auth
authority.

Recommended default:

- no mixed per-user mode;
- no local break-glass auth in Cloud mode for v1;
- local Better Auth remains fully available only when the deployment mode is
  `local`, including localhost development.

If operations later requires emergency access, model it as a separate
deployment-level mode transition with explicit audit trails, not as a hidden
local login fallback inside Cloud mode.

## Implementation Phases

### Phase 0: Design Lock

- Confirm session strategy: Better Auth mirror/session issuer in both modes.
- Confirm local `auth.user.id` strategy: generated local id on first mirror,
  mapped to WorkOS user id through account/external identity.
- Confirm Cloud deployment metadata source for callback allowlist.
- Confirm Cloud assertion signing format and audience.
- Confirm whether DMC is intentionally local-only or must receive the same
  auth-mode wiring as operator.
- Confirm template defaults: Voyant Cloud-provisioned deployments use
  `voyant-cloud`; self-host and local development use `local`.
- Confirm Cloud mode has no local auth fallback and localhost remains local.
- Confirm exact Cloud ownership split: `voyant-cloud/apps/dash` owns interactive
  WorkOS/AuthKit browser routes; `voyant-cloud/apps/api` owns grant,
  exchange, and revalidation APIs.
- Confirm Cloud-owned full callback URI source from app/deployment/release
  metadata.

### Phase 1: Voyant Auth Abstractions

- Add auth mode resolution helper.
- Extract reusable local user profile provisioning so local sign-up and Cloud
  mirror creation share it.
- Add a Better Auth-backed external-user provisioning and session issuance
  helper in `@voyantjs/auth/server`.
- Preserve `user.additionalFields`, `plugins`, and `extraSchema` option shape.
- Add tests around additional fields and extra schema staying forwarded in both
  modes.
- Add tests/documentation that direct Cloud mirror provisioning does not invoke
  consumer Better Auth `databaseHooks.user.create.*`; consumers use
  `onCloudUserProvisioning` instead.

### Phase 2: Cloud Broker API

- Add Cloud grant storage.
- Add dashboard-owned broker start/callback routes and API-owned
  grant/exchange endpoints.
- Validate deployment ownership and full redirect URI.
- Verify WorkOS membership before grant issuance.
- Verify app-level scope such as `scope_app_ids`.
- Return signed narrow JWS assertion.
- Add Cloud-side tests for grant expiry, replay, wrong deployment, wrong
  callback URI, missing membership, inactive org/deployment, and successful
  exchange.

### Phase 3: Admin Cloud Auth Handler

- Add `/auth/cloud/start` and `/auth/cloud/callback`.
- Store state/nonce in signed, short-lived cookie.
- Exchange broker code server-to-server.
- Upsert Better Auth mirror user/account/profile.
- Create local Better Auth session through the Better Auth-backed helper.
- Store Cloud linkage in a side table keyed by local user/session.
- Keep Better Auth plugin endpoints available.
- Block all local identity routes server-side in Cloud mode.
- Update template wiring so Cloud deployments are preconfigured for
  `voyant-cloud` auth and local/self-host examples are preconfigured for
  `local` auth.

### Phase 4: Revalidation And Logout

- Add Cloud revalidation endpoint.
- Add admin-side session revalidation cadence.
- Revoke local session if Cloud membership disappears.
- Revoke or disable personal API keys when Cloud membership disappears.
- Keep local sign-out working.
- Decide whether sign-out also links to Cloud sign-out or only clears local
  admin session.

### Phase 5: Consumer Compatibility Fixture

- Add a test app or test fixture that mounts:
  - `jwt()`
  - plugin schema through `extraSchema`
  - `user.additionalFields.surfaces`
- Verify local mode still issues `/auth/token` and `/auth/jwks`.
- Verify Cloud mode mirror sign-in also issues `/auth/token` and `/auth/jwks`.
- Verify provisioned `surfaces` value is available to the consumer.

### Phase 6: Docs And Migration Notes

- Update `docs/architecture/auth-identity-architecture.md`.
- Update `docs/architecture/admin-architecture.md` if needed.
- Update `packages/auth/README.md` with Cloud mirror/session issuer guidance.
- Add operator template env docs.
- Document security model, grant lifecycle, and relying-party compatibility.

## Acceptance Criteria

- [ ] `local` mode continues to behave as current Better Auth admin auth.
- [ ] First-party templates are prewired for Voyant Cloud auth in Cloud
      deployments.
- [ ] Self-host and local-development template docs/configs use `local` auth
      explicitly.
- [ ] `voyant-cloud` mode redirects unauthenticated users through Voyant Cloud.
- [ ] Voyant Cloud verifies active WorkOS membership for the owning platform
      organization before issuing a grant.
- [ ] Broker grants are high entropy, hashed at rest, one-time-use, short-lived,
      deployment-bound, redirect-bound, and nonce-bound.
- [ ] Admin exchanges broker grants server-to-server.
- [ ] Cloud returns a short-lived signed JWS assertion with `kid`, configured
      issuer, audience, nonce, deployment id, and expiry.
- [ ] `voyant-cloud/apps/dash` owns interactive WorkOS/AuthKit browser routes;
      `voyant-cloud/apps/api` owns grant, exchange, and revalidation APIs.
- [ ] Cloud validates the full callback URI against Cloud-owned
      app/deployment/release metadata.
- [ ] Cloud membership checks include app-level scope such as scoped app ids.
- [ ] Admin creates a local Better Auth session after Cloud exchange.
- [ ] Admin creates that session through a Better Auth-backed helper/endpoint,
      not hand-rolled session row and cookie logic.
- [ ] Admin creates or updates a local Better Auth mirror user and account.
- [ ] Local mirror users use generated local `auth.user.id`; WorkOS user ids are
      mapped through a unique `voyant-cloud` account/external identity row.
- [ ] `/auth/me` works in both modes with the same provider-neutral response
      shape expected by the admin shell.
- [ ] `VoyantRequestAuthContext` remains provider-neutral and does not expose
      WorkOS/platform IDs to domain packages.
- [ ] Cloud mode uses a Better Auth endpoint allowlist and blocks identity
      mutation routes owned by WorkOS/Voyant Cloud.
- [ ] Cloud mode has no local credential/auth fallback.
- [ ] Localhost development can still run all local Better Auth workflows in
      `local` mode.
- [ ] If `jwt()` is mounted, both modes issue verifiable Better Auth JWTs via
      local `/auth/token` and `/auth/jwks`.
- [ ] `user.additionalFields` can be populated in Cloud mode through a
      documented provisioning seam.
- [ ] `extraSchema` remains usable for consumer-mounted Better Auth plugin
      tables in both modes.
- [ ] Local profile provisioning runs for Cloud mirror users.
- [ ] Cloud linkage metadata is stored in a side table and is not exposed
      through Better Auth session response fields.
- [ ] Documentation states whether consumer Better Auth
      `databaseHooks.user.create.*` fire in Cloud mode. For the direct mirror
      path, they do not; `onCloudUserProvisioning` is the equivalent.
- [ ] Session revalidation removes access after Cloud membership removal within
      the configured interval.
- [ ] Personal API tokens for a Cloud-mirrored user are rejected, disabled, or
      revoked after that user's Cloud membership is removed.
- [ ] Self-host deployments do not need WorkOS or Voyant Cloud configuration.

## Out Of Scope

- Replacing Better Auth for self-hosted deployments.
- Direct WorkOS AuthKit setup in every admin deployment as the default path.
- Sharing WorkOS sealed sessions or cookies with tenant admin apps.
- Exposing WorkOS or platform organization IDs to domain modules.
- Per-user runtime mixing of local and Cloud auth modes.
- Full granular RBAC beyond membership-to-staff access.
- Automatic migration of existing local users to Cloud identity.

## Risk Register

- **JWT relying-party regression:** mitigated by keeping Better Auth local
  sessions/JWKS in Cloud mode.
- **Consumer custom-column regression:** mitigated by explicit Cloud
  provisioning hook.
- **Database hook bypass:** mitigated by shared profile provisioning and
  documented `onCloudUserProvisioning` hook; consumer Better Auth create hooks
  do not fire in direct mirror mode.
- **Better Auth identity mutation drift:** mitigated by Cloud-mode endpoint
  allowlist rather than catch-all denylist.
- **API token stale access:** mitigated by token-owner membership revalidation
  and revocation/disable on membership loss.
- **Open redirect:** mitigated by Cloud-owned callback allowlist.
- **Callback URI confusion:** mitigated by validating the exact callback URI
  derived from Cloud-owned app/deployment/release metadata.
- **Grant replay:** mitigated by hashed one-time grants and atomic consume.
- **Session cookie bugs:** mitigated by using a Better Auth-backed helper rather
  than manually reconstructing Better Auth cookie behavior.
- **Duplicate mirror users:** mitigated by unique account mapping for
  `provider="voyant-cloud"` plus WorkOS user id.
- **App-scope bypass:** mitigated by checking membership app scope, not only org
  membership.
- **Membership revocation lag:** mitigated by local session revalidation.
- **Cloud dependency outage:** accepted for v1; do not add hidden local
  break-glass auth inside Cloud mode.
- **Subject instability:** mitigated by generated local `auth.user.id` plus a
  unique `voyant-cloud` external account mapping.

## Verification Lane

Use focused checks while iterating:

```bash
pnpm --filter @voyantjs/auth test
pnpm --filter @voyantjs/hono test
pnpm --filter operator typecheck
pnpm --filter operator test
```

Run broader confidence when shared auth contracts or template wiring change:

```bash
pnpm verify:fast
```

## Proposed First Slice

The first implementation slice should be local to `voyant` and should not
require the Cloud API to exist yet:

1. Add `OperatorAuthMode` resolution.
2. Extract reusable local profile provisioning from the Better Auth
   `user.create.after` hook.
3. Add an internal Better Auth-backed external-user mirror provisioning/session
   issuance helper with tests.
4. Prove `user.additionalFields`, `extraSchema`, and optional `jwt()` plugin
   shape remain intact.
5. Add Cloud-mode Better Auth endpoint allowlist scaffolding.
6. Add template env/config defaults that select `voyant-cloud` for Cloud
   deployments and `local` for self-host/local development.
7. Add placeholder Cloud-mode routes that fail closed with clear configuration
   errors.

That slice makes the admin side ready for the broker while preserving local mode
and consumer extension seams.
