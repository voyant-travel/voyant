# Storefront customer auth in Next.js and Astro

Storefront customers authenticate through the Better Auth customer realm.
`@voyant-travel/storefront/customer-auth-client` is the framework-neutral
client. `@voyant-travel/storefront-react/storefront` adds React buyer-account
state and selection primitives.

```tsx
"use client"

import {
  BuyerAccountSelectionGate,
  BuyerAccountSelector,
  CustomerAccountProvider,
  useBuyerAccounts,
} from "@voyant-travel/storefront-react/storefront"

export function AccountRoot({ children }: { children: React.ReactNode }) {
  return (
    <CustomerAccountProvider baseUrl="/api" fetcher={(url, init) => fetch(url, init)}>
      <BuyerAccountSelectionGate
        loadingFallback={<p>Loading account…</p>}
        selectionFallback={<BuyerAccountSelector />}
      >
        {children}
      </BuyerAccountSelectionGate>
    </CustomerAccountProvider>
  )
}

export function ActiveBuyerName() {
  const { active, loading, error } = useBuyerAccounts()
  if (loading) return <span>Loading…</span>
  if (error) return <span>Account unavailable</span>
  return <span>{active?.name ?? "Choose an account"}</span>
}
```

Selecting an account posts its id and then refetches the customer session and
personal/business account list. The hook also exposes `accounts`, `policy`,
`requiresSelection`, `businessAccountRequests`, and the select/create/request/
cancel/accept operations. Requests use `credentials: "include"`.
OAuth client secrets and managed broker credentials never belong in browser
code.

The account client intentionally models configuration, session state, and buyer
selection. Sign-in and sign-up remain standard Better Auth HTTP endpoints below
`/auth/customer/*`. Use `client.request("sign-in/email", init)` (or a Better Auth
browser client configured against the same BFF base) for those flows; do not
invent a second Voyant login protocol.

## Personal and business customer onboarding

Business customers use the same Better Auth customer realm as individual
customers. A business account is a buyer context backed by a customer auth
organization and a CRM relationship organization; it is not an operator/staff
organization. WorkOS remains an admin-realm concern and is never required by a
storefront customer flow.

The storefront policy decides which call to expose:

- `open`: call `createBusinessAccount(input)`. The React provider explicitly
  activates the returned account and refreshes its account and session state.
- `request`: call `requestBusinessAccount(input)`. Pending requests are exposed
  as `businessAccountRequests` and can be withdrawn with
  `cancelBusinessAccountRequest(requestId)`.
- `invite-only`: do not show customer-initiated create/request controls. Accept
  a business membership invitation with
  `acceptBusinessInvitation({ invitationId })`.
- `disabled`: do not expose business onboarding or invitation acceptance.

Invitation membership can be `owner`, `admin`, or `member`; never assume that
an invited user owns the business account. The operator-facing approval and
provisioning APIs are capability-gated separately from these customer methods.
Invitation emails link to the customer-facing path
`/account/business-invitations/:invitationId` on the configured canonical
storefront origin. Next.js and Astro hosts must own that page, decode the path
parameter, and call `acceptBusinessInvitation({ invitationId })` after the
customer is authenticated. Keep this as a storefront route; do not redirect it
through the operator admin host.

```tsx
function BusinessOnboarding() {
  const buyer = useBuyerAccounts()

  if (buyer.policy?.businessOnboarding === "open") {
    return (
      <button
        disabled={buyer.creatingBusinessAccount}
        onClick={() =>
          void buyer.createBusinessAccount({
            idempotencyKey: crypto.randomUUID(),
            profile: { name: "Acme Travel" },
          })
        }
      >
        Create business account
      </button>
    )
  }

  if (buyer.policy?.businessOnboarding === "request") {
    return <p>{buyer.businessAccountRequests.length} business requests</p>
  }

  return null
}
```

## The same-origin BFF boundary

Managed storefront cookies use the `__Host-` prefix. Browser requests must
therefore reach customer auth through the storefront origin, normally `/api`,
and a storefront server must proxy that path to the Voyant runtime. The proxy
must:

- forward the browser `Cookie` header and every response `Set-Cookie` header
- preserve request method, body, status, and redirects
- set `X-Voyant-Storefront-Origin` from a server-configured canonical storefront origin
- keep the upstream runtime URL server-only

Reject requests whose host does not match that configured origin if the
deployment can receive traffic through untrusted hostnames.

Do not point browser code at the operator/runtime hostname. A cross-origin API
cannot own the storefront's host-only session cookie.

## Next.js App Router

Put the shared proxy in a server-only module such as `lib/voyant-bff.ts`:

```ts
import "server-only"

import type { NextRequest } from "next/server"

export async function proxyVoyant(request: NextRequest, upstreamPath: string) {
  const upstreamBase = process.env.VOYANT_RUNTIME_URL
  const configuredStorefrontOrigin = process.env.VOYANT_STOREFRONT_ORIGIN
  if (!upstreamBase || !configuredStorefrontOrigin) {
    return new Response("Storefront proxy is not configured", { status: 503 })
  }

  const storefrontOrigin = new URL(configuredStorefrontOrigin).origin
  if (request.nextUrl.origin !== storefrontOrigin) {
    return new Response("Misdirected request", { status: 421 })
  }

  const target = new URL(upstreamPath, upstreamBase)
  target.search = request.nextUrl.search
  const headers = new Headers(request.headers)
  headers.set("X-Voyant-Storefront-Origin", storefrontOrigin)
  headers.delete("host")

  return fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
    duplex: "half",
  } as RequestInit)
}
```

Mount catch-all Route Handlers for both API families used by
`CustomerAccountProvider`:

```ts
// app/api/auth/customer/[...path]/route.ts
import type { NextRequest } from "next/server"
import { proxyVoyant } from "@/lib/voyant-bff"

type Context = { params: Promise<{ path: string[] }> }
export async function GET(request: NextRequest, context: Context) {
  return proxyVoyant(request, `/auth/customer/${(await context.params).path.join("/")}`)
}
export const POST = GET

// app/api/v1/public/customer-portal/[...path]/route.ts
export async function GET_PORTAL(request: NextRequest, context: Context) {
  return proxyVoyant(
    request,
    `/v1/public/customer-portal/${(await context.params).path.join("/")}`,
  )
}
export const POST_PORTAL = GET_PORTAL
```

The portal handler is shown with distinct names only to keep both route files
in one snippet; in its own `route.ts`, export it as `GET`/`POST`. Export
equivalent handlers for the other methods your enabled Better Auth and portal
flows need. If a host adapter does not pass multiple `Set-Cookie` values through
a fetch response, copy them individually without combining them.

Server Components and Route Handlers can preload the neutral client. Their
fetcher must forward the incoming cookie to the same-origin `/api` endpoint:

```ts
import { createCustomerAuthClient } from "@voyant-travel/storefront/customer-auth-client"

const storefrontOrigin = process.env.VOYANT_STOREFRONT_ORIGIN
if (!storefrontOrigin) throw new Error("Storefront origin is not configured")
const canonicalStorefrontOrigin = new URL(storefrontOrigin).origin

const client = createCustomerAuthClient({
  baseUrl: new URL("/api", canonicalStorefrontOrigin).toString(),
  fetcher: (url, init) => {
    const headers = new Headers(init?.headers)
    headers.set("cookie", request.headers.get("cookie") ?? "")
    return fetch(url, { ...init, headers })
  },
})
const buyerState = await client.listBuyerAccounts()
```

Mutating auth from a Server Action requires returning Better Auth's cookie
rotation to the browser. `selectBuyerAccountWithResponse`,
`createBusinessAccountWithResponse`, and
`acceptBusinessInvitationWithResponse` return both parsed data and the original
response so the adapter can forward every `Set-Cookie` value. The low-level
`request` method likewise returns an untouched `Response` for sign-in/sign-up
proxies. Never combine multiple `Set-Cookie` values into one comma-delimited
header.

## Astro

Astro must use an SSR adapter. Put the shared proxy in a server-only module and
call it from catch-all endpoints for both `api/auth/customer/[...path].ts` and
`api/v1/public/customer-portal/[...path].ts`:

```ts
import type { APIRoute } from "astro"

function createProxy(upstreamPrefix: string): APIRoute {
  return async ({ request, params, url }) => {
    const upstreamBase = import.meta.env.VOYANT_RUNTIME_URL
    const configuredStorefrontOrigin = import.meta.env.VOYANT_STOREFRONT_ORIGIN
    if (!upstreamBase || !configuredStorefrontOrigin) {
      return new Response("Storefront proxy is not configured", { status: 503 })
    }

    const storefrontOrigin = new URL(configuredStorefrontOrigin).origin
    if (url.origin !== storefrontOrigin) {
      return new Response("Misdirected request", { status: 421 })
    }

    const target = new URL(
      `${upstreamPrefix}/${params.path ?? ""}`,
      upstreamBase,
    )
    target.search = url.search
    const headers = new Headers(request.headers)
    headers.set("X-Voyant-Storefront-Origin", storefrontOrigin)
    headers.delete("host")
    return fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
      duplex: "half",
    } as RequestInit)
  }
}

export const prerender = false
export const GET = createProxy("/auth/customer")
export const POST = GET
```

Use `createProxy("/v1/public/customer-portal")` in the customer-portal endpoint.

A purely static Astro build cannot own customer auth directly: it has no
same-origin server endpoint to exchange or refresh host-only cookies. Deploy an
SSR/server adapter or put a same-origin BFF in front of the static assets.
