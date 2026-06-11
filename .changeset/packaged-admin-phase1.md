---
"@voyantjs/admin-app": minor
---

New package — Phase 1 of the packaged-admin RFC (#1643): the admin
application composition ships as a versioned package; `@voyantjs/admin` stays
the primitives layer.

- `createAdminRouter` / `createAdminQueryClient` — TanStack Router +
  QueryClient with the Voyant defaults (intent preloading with matched
  staleTime, scroll restoration, default not-found page, QueryClient SSR
  dehydrate/hydrate).
- `adminRootHead` / `AdminRootShell` / `AdminRootErrorBoundary` — root route
  internals, including the pre-hydration theme/locale bootstrap script and a
  provider-independent error boundary.
- `createAdminWorkspaceBeforeLoad` — the workspace auth guard (beforeLoad so
  the redirect short-circuits child loaders).
- `AdminWorkspaceShell` — bootstrap gate → per-user message overrides →
  locale sync → workspace layout, with the Slot-compatible `AdminRouterLink`
  as the default nav link.

The operator template consumes it: `router.tsx` (89→15 LOC), `__root.tsx`
(118→29), and `_workspace/route.tsx` (209→95) shrink to wiring; app-owned
parts (provider list, extension definitions, nav icons, auth client) stay in
the template.
