# Auth realm migration

Voyant now treats staff administrators and storefront customers as independent
security realms.

## Deployment provider migration

Prefer:

```ts
providers: {
  adminAuth: "better-auth", // or "voyant-cloud" on managed deployments
  customerAuth: "better-auth", // or "disabled"
}
```

The legacy `providers.auth` value is still accepted as `adminAuth`; it implies
`customerAuth: "better-auth"`. Resolved graphs emit the legacy alias during the
compatibility window so an older runtime can still read a new graph.

## Environment migration

- Rename `BETTER_AUTH_SECRET` to `BETTER_AUTH_ADMIN_SECRET`.
- Generate a distinct `BETTER_AUTH_CUSTOMER_SECRET`.
- Set `VOYANT_CUSTOMER_AUTH_MODE=better-auth` or `disabled`.
- Configure customer method policy through
  `VOYANT_CUSTOMER_AUTH_CONFIG_JSON`. Managed deployments use opaque
  `vault://` credential references and resolve credentials through the runtime
  customer-auth context adapter.

`BETTER_AUTH_ADMIN_SECRET` and `BETTER_AUTH_CUSTOMER_SECRET` are required as
separate values. The runtime does not accept the old shared secret or derive one
realm's secret from the other.

## Identity data migration

New customer users live in `customer_auth.user` and preferences live in
`customer_auth.profile`. Do not bulk-copy admin identities and do not match
customers to admins by email.

For a pre-existing storefront customer:

1. Create or re-establish the customer identity through the customer realm.
2. Move customer-owned preferences to `customer_auth.profile`.
3. Change the CRM link source from `auth.user` to `customer_auth.user` using the
   new customer user id.
4. Revoke the old shared session.

This data migration is deployment-specific because Voyant cannot determine
whether a shared `auth.user` row represented staff, a customer, or both.

## Route migration

Admin Better Auth routes are canonical at `/auth/admin/*`; `/auth/*` remains a
temporary compatibility alias. Customer clients must use `/auth/customer/*`.
Customer routes remain available in `voyant-cloud` admin mode.

## Next.js, Astro, and external storefronts

`@voyant-travel/auth` is the native auth module for a Voyant project. Its Hono
runtime and `createAdminBetterAuth` / `createCustomerBetterAuth` factories expect
Voyant's runtime context and database schema; they are not drop-in Next.js or
Astro adapters.

An external React storefront can use the customer endpoints exposed by its
Voyant deployment. Keep those endpoints same-origin (normally behind the
application's `/api` proxy) so the host-only customer cookie never crosses into
the admin realm:

```tsx
"use client"

import { CustomerAccountProvider } from "@voyant-travel/storefront-react/storefront"

const credentialedFetch = (url: string, init?: RequestInit) =>
  fetch(url, { ...init, credentials: "include" })

export function StorefrontAuth({ children }: { children: React.ReactNode }) {
  return (
    <CustomerAccountProvider baseUrl="/api" fetcher={credentialedFetch}>
      {children}
    </CustomerAccountProvider>
  )
}
```

This component can be mounted directly in Next.js or hydrated as a React island
in Astro. The `/api/auth/customer/*` proxy must forward `Cookie` and
`Set-Cookie` unchanged to the deployment's `/auth/customer/*` routes. Do not
proxy customer requests to `/auth/admin/*` or the legacy `/auth/*` alias.

An external site that owns identity and sessions can instead install Better
Auth through its native Next.js or Astro integration. If it needs to exchange a
verified Auth0, Clerk, WorkOS, or OIDC identity into a Better Auth session, its
integration implements the provider-neutral exported contracts:

```ts
import {
  createExternalIdentitySessionAdapter,
  type BetterAuthIdentityBridge,
  type ExternalIdentityAdapter,
} from "@voyant-travel/auth/auth-realms"

export function connectExternalIdentity<Input, Context>(
  identity: ExternalIdentityAdapter<Input, Context>,
  betterAuth: BetterAuthIdentityBridge<Context>,
) {
  return createExternalIdentitySessionAdapter(identity, betterAuth)
}
```

The website remains responsible for verifying the provider assertion in
`ExternalIdentityAdapter.resolve` and implementing
`BetterAuthIdentityBridge.createSession` with the Better Auth server API for its
chosen framework. Voyant does not accept an unverified browser identity object.
