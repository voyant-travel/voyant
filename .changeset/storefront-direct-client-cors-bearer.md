---
"@voyant-travel/auth": minor
---

Make the storefront public API consumable by direct (cross-origin SPA and
native/mobile) clients with the same operator-configured storefront keys and
per-storefront allowed origins already used by the same-origin BFF.

- The local storefront customer-auth resolver now derives the storefront origin
  from the standard `Origin` header when the BFF `x-voyant-storefront-origin`
  header is absent (the BFF header still wins), so direct clients authorize
  against a storefront's declared origins without a BFF hop. The server/BFF
  contract is unchanged.
- The resolved storefront's declared origins are folded into Better Auth
  `trustedOrigins` (unioned with the static env allowlist) at request time, and
  surfaced as `allowedOrigins` on the customer auth context for dynamic CORS.
- Direct clients use bearer customer sessions: the customer Better Auth realm now
  enables the `bearer` plugin, so a sign-in returns a session token the client
  sends as `Authorization: Bearer <token>` on later `/v1/public/*` calls. Cookies
  stay host-only and BFF/same-origin only (no `SameSite=None`).
- A request-time dynamic-CORS origin authorizer (`resolveCustomerCorsOrigin`)
  echoes only a storefront-authorized origin (never `*`) for the customer realm
  (`/v1/public/*` + `/auth/customer/*`); keyless preflight is authorized against
  any storefront that declares the origin via the new
  `StorefrontRuntimeProvider.resolveStorefrontByOrigin`. Admin/dash surfaces keep
  the static `CORS_ALLOWLIST` behavior. The shared Hono `cors()` middleware and
  the `VoyantAuthIntegration.resolveCorsOrigin` seam carry this into the app.
