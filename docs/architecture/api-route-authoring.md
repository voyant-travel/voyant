# Voyant API Route Authoring

This guide defines how Voyant packages should author HTTP routes across the
admin and public API surfaces.

The goal is simple:

- keep route surfaces explicit
- keep request parsing and error handling consistent
- keep auth rules easy to reason about
- keep package routes aligned with the shared `/v1/admin/*` and `/v1/public/*`
  transport model

This is not a new routing framework. It is a consistency guide for the Hono
surface Voyant already has.

Hono is Voyant's first-class HTTP route interface. Packages should expose Hono
route factories, `HonoModule`s, or `HonoExtension`s rather than framework-specific
route handlers.

For route ownership and deployment composition rules, see
[`api-route-ownership-and-composition.md`](./api-route-ownership-and-composition.md).

## Core Rules

### 1. Keep the surface split explicit

Voyant has three transport buckets:

- `/v1/admin/*` for staff and operator routes
- `/v1/public/*` for customer, partner, supplier, and other external-facing
  routes
- `/auth/*` for session and authenticated-user operations

Use `adminRoutes` for operator-facing CRUD and internal tooling.
Use `publicRoutes` for customer-facing and other external-facing contracts.

Do not add new package routes to the legacy `routes` surface unless there is a
strong backwards-compatibility reason.

Rule:

Every new package route should declare whether it belongs to the admin or
public surface.

### 2. Keep `storefront` as a package concept, not an HTTP namespace

Voyant should keep `storefront` as the customer-facing package/runtime term:

- `@voyant-travel/storefront`
- `@voyant-travel/storefront-react`

But the HTTP surface should stay under `/v1/public/*`, not
`/v1/public/storefront/*`.

Rule:

Use `/v1/public/*` as the external-facing API umbrella. Do not add an extra
`storefront` URL layer by default.

### 3. Organize public routes by capability, not by frontend

Public routes should be grouped by the business capability they expose:

- bookings
- products
- pricing
- finance
- customer portal

Do not shape public routes around which frontend happens to call them.

Rule:

Public URLs describe the capability, not the app.

## Request Validation

### 4. Parse request bodies through `parseJsonBody(...)`

For JSON request bodies, use the shared Hono helper instead of open-coded
`await c.req.json()` plus local schema parsing.

Prefer:

```ts
const body = await parseJsonBody(c, createBookingSchema)
```

This gives routes:

- consistent invalid JSON handling
- consistent schema-validation responses
- consistent error codes and payload shape

Rule:

If a route accepts JSON, parse it through `parseJsonBody(...)`.

### 5. Parse query parameters through `parseQuery(...)`

For query strings, use the shared Hono helper instead of manual
`new URL(...).searchParams` plus ad hoc coercion.

Prefer:

```ts
const query = parseQuery(c, bookingListQuerySchema)
```

Rule:

If a route accepts query parameters, parse them through `parseQuery(...)`.

### 6. Keep route schemas local to the route contract

Route-level request schemas should live close to the route surface they define.

That usually means:

- package schema files for reusable request/response contracts
- route files using those schemas through `parseJsonBody(...)` and
  `parseQuery(...)`

Do not hide request-shape logic in ad hoc middleware or untyped body handling.

## Auth And Access Control

### 7. Let the shared auth middleware establish request identity

The Hono app-level auth middleware is responsible for attaching request auth
context.

Package routes should consume that shared context rather than rebuilding auth
checks locally.

Rule:

Routes should rely on the shared auth pipeline, not invent package-local auth
state handling.

### 8. Use `requireUserId(...)` for authenticated user routes

If a route requires a signed-in user, use the shared helper:

```ts
const userId = requireUserId(c)
```

Do not read `c.get("userId")` manually and hand-roll 401 payloads.

Rule:

User-scoped routes should use `requireUserId(...)` instead of open-coded
presence checks.

### 9. Use actor and permission guards intentionally

Voyant has different auth concerns:

- authenticated user
- resolved actor/workspace context
- permission checks

Use the narrowest guard that matches the route:

- `requireUserId(...)` for “must be signed in”
- actor-aware middleware when the route depends on workspace/actor context
- permission checks when the route depends on explicit grants

Do not collapse all access control into one generic route guard.

Rule:

Pick the smallest auth primitive that matches the route’s actual needs.

### 9a. API tokens use Better Auth permissions

API tokens are Better Auth API keys for automation and cross-runtime calls, not
operator sessions. Their permissions use Better Auth's `Record<string,
string[]>` shape, for example `{ products: ["read"], workflows: ["trigger"] }`.

For Hono routes, API-key callers are admitted by `requireActor(...)` only when
the key has a method-derived permission for the route resource. See
`docs/architecture/service-api-keys.md` for the current derivation rules and
permission catalog.

Rule:

When adding a route that should be callable by third-party systems or external
automation, document the expected API token permission and keep the route's
resource segment aligned with that permission.

## Error Handling

### 10. Throw or normalize shared API errors

Use the shared API error model instead of hand-crafting route JSON for common
error classes.

Examples:

- `RequestValidationError`
- `UnauthorizedApiError`
- `ForbiddenApiError`

If a route needs to convert a local branch into a response immediately, prefer
`handleApiError(...)` over hand-built JSON payloads.

Rule:

Routes should use the shared Hono API error types so admin/public responses stay
consistent.

### 11. Keep validation and authorization failures structured

Validation failures should return the shared invalid-request shape.
Authorization failures should return the shared unauthorized/forbidden shape.

Do not let each package invent its own 400/401/403 response contract.

Rule:

Common API failures should serialize through the shared error boundary or the
shared error helpers.

## Route Design

### 12. Keep package routes thin

Routes should:

- validate the request
- resolve runtime services from the request context
- call package services or workflows
- serialize the response

Do not bury business orchestration in the route body if it belongs in a module
service or workflow.

Rule:

Routes should translate HTTP to package/service calls, not become the business
logic layer.

### 13. Prefer extension over override

When a package route surface needs customization, prefer:

- adding new package routes
- adding app-owned routes
- extending workflows or providers behind the route

Treat full route override as the last resort.

Rule:

Extend existing route surfaces before replacing them.

### 14. Keep response shapes explicit and stable

Route handlers should return typed, intentional payloads.

Do not rely on implicit table shapes or package-internal row objects as the
public contract by default.

That does not mean every route needs a separate DTO file, but it does mean the
response shape should be treated as a real surface, not an accident of current
service internals.

Rule:

Public and admin responses should be shaped on purpose, not leaked by
implementation detail.

## Public Mounting

### 15. Use `publicPath` only when the URL shape truly needs it

Modules and extensions can override their public mount path relative to
`/v1/public`.

That should be used sparingly:

- to mount a package directly at the public root when the contract is truly
  root-scoped
- to keep the public surface clean when the package name would add redundant
  path nesting

It should not become a way to make URL ownership ambiguous.

Rule:

Default to `{module.name}` for public routes. Use `publicPath` only when the
public contract is clearer because of it.

## Practical Checklist

When authoring or reviewing a Voyant API route:

1. Decide whether it belongs to the admin or public surface.
2. Keep the URL organized by capability, not by frontend.
3. Parse JSON through `parseJsonBody(...)`.
4. Parse query parameters through `parseQuery(...)`.
5. Use `requireUserId(...)` or the smallest matching auth/permission guard.
6. Use shared API error types for validation and authorization failures.
7. Keep business logic in services or workflows, not in the route body.
8. Prefer extension over full route override.
9. Treat the response shape as an intentional contract.

## Non-Goals

This guide does not introduce:

- a new router abstraction
- a generic request/response framework on top of Hono
- a requirement that every route define separate DTO files
- a new HTTP namespace beyond `/v1/admin/*` and `/v1/public/*`

The point is consistency and clarity, not more ceremony.
