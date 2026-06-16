---
"@voyant-travel/hono": minor
---

Add first-class, context-preserving lazy route contributions. `HonoModule` and
`HonoExtension` now accept `lazyAdminRoutes` / `lazyPublicRoutes` loaders
(`() => Promise<Hono>`); `createApp` mounts them at the surface prefix,
dynamically imports the bundle on first matching request, and caches it per
isolate. Unlike a raw `subApp.fetch(...)` forward, the dispatcher bridges the
request context (`c.var` — db, container, actor, …) into the loaded sub-app, so
lazy routes behave identically to eager ones.

Also adds `lazyRoutes?: { paths, load }` for deployment-local families that span
multiple absolute path prefixes (the context-preserving replacement for ad-hoc
`mountLazyRouteApp` forwards). New exports: `mountLazyRoutesAt`,
`mountLazyRoutePaths`, `createLazyRouteHandler`, `LazyRoutesLoader`,
`LazyHonoRoutes`.
