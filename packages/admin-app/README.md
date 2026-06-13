# @voyantjs/admin-app

Compatibility package for the admin app shell.

The implementation now lives in `@voyantjs/admin/app/*` so the top-level
`admin` package owns the packaged staff shell and extension surface. This
package remains temporarily available for existing imports and re-exports the
same root document, router defaults, auth-guarded workspace shell, route binder,
and core extension helpers.

## What it provides

- **`createAdminRouter({ routeTree })`** / **`createAdminQueryClient()`** —
  TanStack Router + QueryClient with the Voyant defaults: intent preloading
  with matched staleTime, scroll restoration, default not-found page, and
  QueryClient SSR dehydrate/hydrate.
- **`adminRootHead({ title, ... })`** / **`AdminRootShell`** /
  **`AdminRootErrorBoundary`** — the root route internals, including the
  pre-hydration theme/locale bootstrap script (no theme flash) and an error
  boundary that survives outside the provider tree.
- **`createAdminWorkspaceBeforeLoad({ getCurrentUser })`** — the auth guard,
  in `beforeLoad` so the redirect short-circuits child loaders instead of
  racing them.
- **`AdminWorkspaceShell`** — bootstrap gate → per-user message overrides →
  locale sync → workspace layout, with `AdminRouterLink` (Slot-compatible,
  external-URL-aware) as the default nav link. Pass `destinations` (a
  `satisfies AdminDestinationResolvers` map) to mount the semantic-destination
  contract: packaged pages resolve `AdminDestinations` keys to hrefs via
  `useAdminHref`/`useAdminNavigate`, and the shell routes them through the app
  router.

## Usage

```tsx
// src/router.tsx
import { createAdminRouter } from "@voyantjs/admin/app"

export const getRouter = () => createAdminRouter({ routeTree })

// src/routes/__root.tsx
import { AdminRootErrorBoundary, AdminRootShell, adminRootHead } from "@voyantjs/admin/app/root"

export const Route = createRootRouteWithContext<AdminRouterContext>()({
  head: () => adminRootHead({ title: "Acme Admin" }),
  shellComponent: AdminRootShell,
  component: RootComponent, // app-owned: mounts the app's provider stack
  errorComponent: AdminRootErrorBoundary,
})

// src/routes/_workspace/route.tsx
import {
  AdminWorkspacePendingFallback,
  AdminWorkspaceShell,
  createAdminWorkspaceBeforeLoad,
} from "@voyantjs/admin/app/workspace"

export const Route = createFileRoute("/_workspace")({
  ssr: "data-only",
  beforeLoad: createAdminWorkspaceBeforeLoad({ getCurrentUser }),
  loader: ({ context }) => ({ user: context.user }),
  pendingComponent: AdminWorkspacePendingFallback,
  component: () => (
    <AdminWorkspaceShell
      user={user}
      icons={navigationIcons}
      extensions={(messages) => createMyAdminExtensions(messages)}
      destinations={myAdminDestinations} // key → href resolvers, satisfies AdminDestinationResolvers
      onSignOut={() => signOut({ redirectTo: "/sign-in" })}
    >
      <Outlet />
    </AdminWorkspaceShell>
  ),
})
```

What stays app-owned: the provider list (which domain modules are mounted),
extension definitions, navigation icons, branding, and the auth client.

Existing `@voyantjs/admin-app` imports continue to work through this package,
but new first-party code should import from `@voyantjs/admin/app/*`.

## License

Apache-2.0
