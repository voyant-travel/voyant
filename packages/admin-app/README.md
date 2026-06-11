# @voyantjs/admin-app

The Voyant admin application factory: the root document, router defaults,
auth-guarded workspace shell, and router-aware navigation — the composition
glue every Voyant admin previously copied from the template, delivered as a
versioned package.

Part of the Packaged Admin direction (`docs/architecture/packaged-admin-rfc.md`,
Phase 1). `@voyantjs/admin` stays the primitives package (providers, layout,
extension seam); this package owns the application-level composition on top.

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
  external-URL-aware) as the default nav link.

## Usage

```tsx
// src/router.tsx
export const getRouter = () => createAdminRouter({ routeTree })

// src/routes/__root.tsx
export const Route = createRootRouteWithContext<AdminRouterContext>()({
  head: () => adminRootHead({ title: "Acme Admin" }),
  shellComponent: AdminRootShell,
  component: RootComponent, // app-owned: mounts the app's provider stack
  errorComponent: AdminRootErrorBoundary,
})

// src/routes/_workspace/route.tsx
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
      onSignOut={() => signOut({ redirectTo: "/sign-in" })}
    >
      <Outlet />
    </AdminWorkspaceShell>
  ),
})
```

What stays app-owned: the provider list (which domain modules are mounted),
extension definitions, navigation icons, branding, and the auth client.

## License

Apache-2.0
