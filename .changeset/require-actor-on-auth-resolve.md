---
"@voyantjs/hono": minor
---

Make `actor` required on `VoyantRequestAuthContext` and surface a better 401 when it's missing (fixes #381).

`requireActor` is fail-closed — when `c.var.actor` is unset, every protected request 401s. Previously the type kept `actor` optional, the API-key branch hard-coded `"staff"`, the public-paths branch hard-coded `"customer"`, but the custom `auth.resolve` branch had no enforcement, no default, and a 401 message that read like a session bug. Consumers upgrading with a working session resolver saw every `/v1/admin/*` route 401 after a valid sign-in.

**Type-level enforcement (BREAKING for custom resolvers):**

```ts
// Before
export type VoyantRequestAuthContext = VoyantAuthContext & {
  userId: string
}

// After
export type VoyantRequestAuthContext = Omit<VoyantAuthContext, "actor"> & {
  userId: string
  actor: Actor
}
```

Any `auth.resolve` integration whose return type is `VoyantRequestAuthContext` now fails to compile until it includes `actor`. For single-tenant admin apps, return `actor: "staff"`. Customer/partner/supplier sessions should return the corresponding actor so `/v1/public/*` route guards keep working.

`requirePermission` now also throws if `actor` is missing on the request context (it should be set by `requireActor` upstream); this surfaces auth-pipeline misordering rather than fabricating a default.

**Better 401 message:**

```
Unauthorized: actor not resolved. The auth pipeline did not assign an `actor`
to this request. If you set `auth.resolve` on `createApp({...})`, the returned
object must include `actor` (usually `"staff"` for admin sessions). Public
routes should be listed in `publicPaths`.
```

**Migration:** add `actor: "staff"` (or the appropriate actor) to whatever your `auth.resolve` returns. The DMC and operator templates and the dev app have all been updated.
