# ADR-0003: Admin API contract + SDK for non-web admin clients

- **Status:** Proposed (2026-06-01)
- **Relates to:** [#1411](https://github.com/voyant-travel/voyant/issues/1411)
- **Builds on:** [ADR-0002](./0002-contract-packages.md) (the `*-contracts` pattern), [ADR-0001](./0001-tenant-scoping.md) (deployment = tenancy boundary)

## Context

Voyant deployments expose rich admin functionality over `/v1/admin/*`. Today
the only first-class consumer is the web admin (TanStack Router + Better Auth +
local shadcn components), which talks to those routes with bespoke per-route
fetch code.

New consumers need the *same* operations without the web stack:

- a **React Native + Expo** mobile admin app (native operator workflows, not
  just an AI chat),
- **Max / AI agents** invoking admin actions as tools,
- **automation workers** and **Voyant Cloud brokers** forwarding operator
  intent to a deployment.

If mobile UI, web UI, Max tools, and brokers each invent their own per-route
integration layer, the operation surface, permission semantics, and audit
attribution drift four ways. #1411 asks for a shared **Admin API contract** and
**SDK** so every caller speaks one typed, versioned surface.

### What already exists (from codebase recon)

- **Routes:** each `ApiModule` exposes `adminRoutes` mounted at
  `/v1/admin/{module}` (`packages/hono/src/app.ts`). Bookings has ~33 admin
  operations; finance ~130+.
- **Auth:** a 4-strategy chain (`packages/hono/src/middleware/auth.ts`) —
  internal key, core-owned `voy_` API keys (SHA-256 hashed, scoped), a custom
  `auth.resolve()` integration, and session JWT bearer. Context carries
  `userId`, `actor`, `callerType`, `scopes`, `organizationId`.
- **Actors:** `staff | customer | partner | supplier` (+ `agent | system`
  extended per-module). `/v1/admin/*` requires `staff`
  (`require-actor.ts`).
- **Scopes:** API keys carry `resource:action` scopes
  (`@voyant-travel/types/api-keys`) — 18 resources × {read, write, delete, trigger,
  relay, search}, with wildcards and presets.
- **Audit:** `@voyant-travel/action-ledger` records every mutation with a principal
  type (`user | api_key | agent | workflow | system`), action kind, evaluated
  risk, approvals, and causation/correlation IDs.
- **Confirmation gates:** status mutations (confirm/cancel/override/…) are
  capability-gated and, for `agent`/`workflow` callers, can require an
  **approval** — returning `202` with an approval payload instead of performing
  the action. This is exactly the "requires confirmation" semantics #1411 wants.
- **Conventions:** offset pagination `{ data, total, limit, offset }`; error
  shape `{ error, code?, requestId?, details? }` (`@voyant-travel/types`); zod input
  validation per package; `Idempotency-Key` on mutations.
- **Gap:** there is **no capability-discovery endpoint** — nothing surfaces
  enabled modules, supported operations, deployment version, or required scopes
  to a client.

## Decision

**Ship a dedicated `@voyant-travel/admin-*` package family that defines admin
operations as typed, versioned, transport-agnostic descriptors, plus a
framework-neutral client that executes them. Web, Expo, Max tools, and brokers
all consume the same descriptors, so permission and audit semantics are
identical across callers.**

### Package family

- **`@voyant-travel/admin-contracts`** — the contract layer. Pure, `zod`-only (plus
  the relevant `*-contracts` domain packages for payload shapes). Owns:
  - shared envelopes: error, offset + cursor pagination, the approval/`202`
    result, idempotency semantics;
  - the **`OperationDescriptor`** type and `defineOperation()` helper —
    `{ id, method, path(params), input, output, classification, scopes,
    capabilityKey? }`;
  - **action classification** metadata (`read | routine_write | destructive |
    requires_confirmation`) so the same descriptor can drive native buttons,
    Max tool risk gating, audit `actionKind`, and confirmation UI;
  - the **capability-discovery** descriptor (enabled modules, available
    operations, deployment version, required scopes/permissions);
  - the per-domain operation catalogues (`bookings.*`, `finance.*`, …),
    referencing domain payload types from the `*-contracts` packages rather
    than redeclaring them.
- **`@voyant-travel/admin-client`** — a framework-neutral TypeScript client.
  `createAdminClient({ baseUrl, auth, fetch? })` returns typed operation
  namespaces built from the descriptors. Handles base URL, auth header
  injection (API key **or** bearer/session), typed errors, pagination,
  idempotency keys, and capability discovery. **No React, no web-UI, no
  framework runtime deps** — runs in Expo, Node, Workers, and Max tools.
- **`@voyant-travel/admin-react`** *(optional, follow-up)* — React Query hooks over
  `admin-client` for React UIs. TanStack Query is renderer-agnostic, so the one
  package serves the web admin **and** a React Native / Expo app.

There is deliberately **no `admin-expo` and no Max adapter package**. Expo (React
Native is just TypeScript), Max/AI tools, and the Voyant Cloud broker are all
TypeScript + zod and call `admin-client` directly. Max in particular needs no
wrapper layer: a descriptor already carries the zod input schema and
`classification`, so turning the catalogue into agent tool definitions is a small
mapping helper, not an adapter.

The naming uses the `-contracts` suffix established by ADR-0002 (so the family
reads `admin-contracts` / `admin-client`, plus an optional `admin-react`),
rather than the alternative per-domain `bookings-client` / `finance-client`
split — see Alternatives.

### Operation descriptor (the load-bearing shape)

```ts
const confirmBooking = defineOperation({
  id: "bookings.confirm",
  method: "POST",
  path: (p: { id: string }) => `/v1/admin/bookings/${p.id}/confirm`,
  input: confirmBookingInput,          // zod
  output: bookingOutput,               // zod, references @voyant-travel/bookings shapes
  classification: "requires_confirmation",
  scopes: ["bookings:write"],          // resource:action, matches API-key scopes
  capabilityKey: "booking.status.confirm",
})
```

A descriptor is data: the client turns it into a typed call; a Max-tool wrapper
turns it into a tool definition with risk metadata; the capabilities endpoint
lists it; the audit layer reads its `classification`/`capabilityKey`. One
definition, many consumers.

### Capability discovery

`admin-contracts` defines a capabilities descriptor, and `createApp` serves a
small built-in `GET /v1/admin/_meta/capabilities` route (under the staff guard)
that returns: enabled modules, the operation ids available on this deployment,
the deployment/contract version, and the caller's resolved actor + scopes.
Clients call `client.capabilities()` to adapt to module availability and version
— no hard-coding which modules a given deployment runs. To keep `@voyant-travel/hono`
decoupled from `admin-contracts`, the deployment injects the catalogue via
`createApp({ adminMeta: { contractVersion, operations } })` (from
`admin-contracts`' `ADMIN_CONTRACT_VERSION` + `operationCapabilities()`); when
omitted, the route is not mounted.

### Boundaries this decision keeps

- **Deployment isolation (ADR-0001) is unchanged.** The client targets one
  deployment `baseUrl` (or a broker that forwards to one). No operational admin
  data is centralized in Voyant Cloud.
- **Web admin UI packages stay decoupled** from the SDK — they may adopt
  `admin-client` over time, but the contract does not depend on them.
- **Domain business logic stays in the domain packages.** `admin-contracts`
  describes the existing routes; it does not reimplement services.
- **Audit/permission semantics are the server's.** The SDK carries the caller's
  credentials and idempotency/approval context; the server's action-ledger and
  scope checks remain the enforcement point. The contract just makes the
  classification and required scopes *legible* to clients ahead of the call.

### Scope of the first slice

The first implementation slice covers **bookings** (list, get, confirm, cancel)
and **finance** (invoice list/get, record payment, create payment link), per
#1411's priority. The full operation catalogue, the server-side capabilities
route, and the React/Expo/Max adapters are explicit follow-ups (see Roadmap).

## Consequences

### Positive

- **One surface, many callers.** Mobile, web, Max, and brokers invoke the same
  typed operations with consistent permission + audit semantics.
- **Risk is legible before the call.** `classification` lets a client show a
  confirm dialog, a Max tool require approval, and audit tag the action —
  driven by one piece of metadata, not four hand-maintained lists.
- **Capability discovery decouples clients from deployment config.** A client
  adapts to enabled modules and version instead of assuming them.
- **Reuses the contract-package discipline.** Payload shapes come from the
  `*-contracts` packages (ADR-0002); the SDK is zod-only and runs anywhere.

### Negative

- **A second description of the routes.** The descriptors must track the actual
  handlers. Mitigated by keeping descriptors thin (path + zod + metadata) and,
  over time, by generating/asserting them against the routes in CI.
- **Surface curation.** Not every internal route should be public SDK surface;
  deciding what is admin-public is ongoing work (the issue lists priorities).
- **New packages + a new server meta route.** More workspace surface and one
  new framework endpoint.

### Mitigations

- **Descriptor/route drift:** a CI check (follow-up) asserts every descriptor's
  `path`/`method` resolves to a mounted admin route, and that its input schema
  matches the route's validator where both exist.
- **Versioning:** the capabilities descriptor carries a contract version; the
  client warns on major-version skew with the target deployment.

## Alternatives considered

### Alternative A: one mega `@voyant-travel/admin` package (contract + client + hooks)

Reject — it forces an Expo or Node caller to pull React Query and web concerns,
and couples the framework-neutral client to UI adapter churn. The
contract/client/adapter split keeps the neutral core installable everywhere.

### Alternative B: per-domain client packages (`bookings-client`, `finance-client`)

The issue floats this. Reject as the *primary* surface — mobile and Max want a
**single** admin client with cross-module capability discovery and one auth/base
config, not N clients to wire up. Per-domain *namespaces* inside one
`admin-client` (`client.bookings.*`, `client.finance.*`) give the modularity
without N packages. (Per-domain contract *packages* already exist for payload
shapes via ADR-0002; this is about the operation/SDK layer.)

### Alternative C: generate the SDK from Hono RPC types

Voyant's routes use Hono's chained-RPC types. A generated client is appealing
but (a) leaks server/runtime types into clients, (b) can't express
classification/scope/capability metadata, and (c) doesn't give a stable,
reviewable versioned contract. Hand-authored descriptors that *reference*
`*-contracts` payload types are the stable public surface; RPC-type assertions
can be a CI guard, not the public API.

### Alternative D: GraphQL / OpenAPI gateway

Reject for this issue — it introduces a new runtime/build surface and doesn't
align with the existing Hono `/v1/admin/*` reality or the per-deployment model.
The descriptor approach is a thin typed layer over what already ships.

## Roadmap (follow-ups, not this slice)

1. ✅ **Done** — server-side `GET /v1/admin/_meta/capabilities`, mounted by
   `createApp({ adminMeta })`.
2. Expand the operation catalogue beyond the first slice (CRM, legal, products,
   workflows, settings) per #1411's priority list.
3. An optional `@voyant-travel/admin-react` (React Query hooks) for React UIs —
   serves both the web admin and a React Native / Expo app (no separate Expo
   adapter; TanStack Query is renderer-agnostic).
4. CI guard asserting descriptor ↔ route consistency.

**Out of scope for this framework repo:** the Max / AI agent product is part of
Voyant Cloud. It consumes `admin-client` and the descriptors directly — the
descriptors already carry the zod input schema and `classification` needed to
build agent tools — so there is no Max adapter package here. At most the
framework might offer a small *provider-agnostic* descriptor→tool-definition
helper; the Max-specific integration (agent runtime, auth context, the Cloud
broker) is Cloud's.

## How to apply this decision

When exposing an admin operation to non-web clients, **add an
`OperationDescriptor` to `@voyant-travel/admin-contracts`** (input/output zod,
`classification`, `scopes`, `capabilityKey`) rather than writing bespoke fetch
code in the client. Reference payload types from the relevant `*-contracts`
package. Consumers (mobile, Max, brokers, web) get the operation for free
through `@voyant-travel/admin-client`; do not hand-roll a parallel integration layer.
