# @voyantjs/admin

Reusable admin dashboard primitives for Voyant templates. Pure, transport-agnostic React providers and helpers — no UI components tied to a specific shadcn copy.

## Install

```bash
pnpm add @voyantjs/admin
```

## Usage

```typescript
import { AdminProvider } from "@voyantjs/admin/providers/admin-provider"
import { OperatorAdminShellProvider } from "@voyantjs/admin/providers/operator-admin-shell"
import { ThemeProvider, useTheme } from "@voyantjs/admin/providers/theme"
import { makeQueryClient } from "@voyantjs/admin/providers/query-client"
import { getInitials, getDisplayName } from "@voyantjs/admin/lib/initials"
import { OperatorAdminWorkspaceLayout } from "@voyantjs/admin/components/operator-admin-sidebar"
import {
  createAdminExtensionRegistry,
  defineAdminExtension,
  resolveAdminNavigation,
} from "@voyantjs/admin"

function App() {
  return (
    <AdminProvider defaultTheme="system">
      <Dashboard />
    </AdminProvider>
  )
}
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./components/admin-nav-group` | Sidebar navigation group renderer |
| `./components/admin-nav-link` | Navigation link adapter types and default anchor link |
| `./components/admin-widget-slot` | Widget slot renderer for admin extension widgets |
| `./components/operator-admin-bootstrap-gate` | Single-tenant-first shell bootstrap gate |
| `./components/operator-admin-sidebar` | Operator sidebar and workspace layout |
| `./components/operator-admin-user-menu` | Operator user/account/theme/locale menu |
| `./components/team-settings-page` | Operator team invitation settings composition |
| `./extensions` | Admin extension types and helpers |
| `./navigation/operator-navigation` | Base operator admin navigation factory |
| `./providers/admin-provider` | `AdminProvider` composing QueryClient + Theme |
| `./providers/locale-preferences` | `AdminLocalePreferenceSync` for user locale/timezone defaults |
| `./providers/operator-admin-shell` | `OperatorAdminShellProvider` and provider stack helpers |
| `./providers/operator-admin-messages` | Operator admin message provider and hooks |
| `./providers/theme` | `ThemeProvider`, `useTheme` with system-theme support |
| `./providers/query-client` | `makeQueryClient(config?)` factory with Voyant defaults |
| `./lib/initials` | `getInitials`, `getDisplayName` helpers |
| `./types` | `AdminUser`, `NavItem`, `NavSubItem`, `ThemeMode`, `AuthActions` |

## Admin Extensions

Use `defineAdminExtension(...)` to declare shared admin contributions and keep
the extension surface explicit:

```ts
import { defineAdminExtension } from "@voyantjs/admin"

export const financeExtension = defineAdminExtension({
  id: "finance-tools",
  navigation: [
    {
      order: 10,
      items: [{ id: "settlements", title: "Settlements", url: "/finance/settlements" }],
    },
  ],
})
```

Templates can merge those contributions into their base navigation with
`resolveAdminNavigation(...)` and expose widget slots with
`resolveAdminWidgets(...)`. When a template wants one explicit source-controlled
registry, compose it with `createAdminExtensionRegistry(...)`.

Render widgets from a template-owned registry with `AdminWidgetSlotRenderer`:

```tsx
import { AdminWidgetSlotRenderer, createAdminExtensionRegistry } from "@voyantjs/admin"

const adminExtensions = createAdminExtensionRegistry(financeExtension)

function DashboardHeader({ dashboard }) {
  return (
    <AdminWidgetSlotRenderer
      extensions={adminExtensions}
      slot="dashboard.header"
      props={{ dashboard }}
    />
  )
}
```

The operator template currently exposes these stable slots:
`dashboard.header`, `dashboard.after-kpis`, `dashboard.footer`,
`booking.details.header`, `booking.details.after-summary`,
`invoice.details.header`, and `invoice.details.after-summary`.

## Operator Shell

Operator apps can centralize the standard provider order with
`OperatorAdminShellProvider`. It composes `AdminProvider`,
`VoyantReactProvider`, operator admin messages, optional app-level providers,
and optional domain UI message providers that accept `{ locale, children }`.

```tsx
import {
  type AdminDomainMessagesProvider,
  OperatorAdminShellProvider,
} from "@voyantjs/admin"
import { BookingsUiMessagesProvider } from "@voyantjs/bookings-ui/i18n"

const domainMessageProviders = [
  BookingsUiMessagesProvider,
] satisfies readonly AdminDomainMessagesProvider[]

function App({ queryClient }: { queryClient: QueryClient }) {
  return (
    <OperatorAdminShellProvider
      baseUrl="/api"
      queryClient={queryClient}
      domainMessageProviders={domainMessageProviders}
    >
      <Dashboard />
    </OperatorAdminShellProvider>
  )
}
```

Use `OperatorAdminWorkspaceLayout` to reuse the standard sidebar chrome while
keeping app-owned routing and sign-out behavior explicit:

```tsx
import { Link, useRouterState } from "@tanstack/react-router"
import { OperatorAdminWorkspaceLayout } from "@voyantjs/admin"

const AdminLink = ({ children, href, onClick, target }) => (
  <Link to={href} onClick={onClick} target={target}>
    {children}
  </Link>
)

function Workspace({ children, user }) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname })

  return (
    <OperatorAdminWorkspaceLayout
      currentPath={currentPath}
      linkComponent={AdminLink}
      user={user}
      onSignOut={() => signOut({ redirectTo: "/sign-in" })}
    >
      {children}
    </OperatorAdminWorkspaceLayout>
  )
}
```

`OperatorAdminShellProvider` and `OperatorAdminWorkspaceLayout` do not fetch or
require Better Auth organizations. First-party Voyant templates are
single-tenant per deployment: load the current authenticated user first, then
render the shell with the `user` prop.

Use `OperatorAdminBootstrapGate` to make that contract explicit:

```tsx
<OperatorAdminBootstrapGate user={user} isUserLoading={isLoading}>
  <OperatorAdminWorkspaceLayout user={user}>{children}</OperatorAdminWorkspaceLayout>
</OperatorAdminBootstrapGate>
```

The workspace layout follows the shadcn sidebar composition with a
`SidebarInset` main region and a visible sidebar trigger in the inset header.
Pass `variant="inset"` or `variant="floating"` and `side="right"` when an app
needs one of the modern sidebar variants. The sidebar can also be toggled with
`Cmd+B` on macOS or `Ctrl+B` on Windows and Linux.

Route-level document titles are derived from `navItems` and `currentPath` by
default, so `/bookings` renders `Bookings · Voyant` and tracks the active
locale when the navigation messages change. `AdminPageHead` also keeps
`<html lang>` synchronized with `useLocale().resolvedLocale` and updates the
description and Open Graph description meta tags when a description is provided.
Apps can override detail routes that are not represented by navigation items
with `useAdminPageHead`:

```tsx
import { useAdminPageHead } from "@voyantjs/admin"

function ProductDetailPage({ product }) {
  useAdminPageHead({
    title: product.name,
    description: product.summary,
  })

  return <ProductDetailLayout product={product} />
}
```

Set `pageHead={false}` on `OperatorAdminWorkspaceLayout` only when an app owns
all document metadata itself.

The default brand uses the exported `VoyantMark` and `VoyantWordmark` SVG
components and swaps from wordmark to mark in collapsed icon mode. Apps that
need a custom lockup can pass `brand={<MyBrand />}` or compose those exported
brand components directly.

Workspace switching and team-management routes remain app-owned opt-ins. Apps
that intentionally implement workspace switching can opt into
`mode="organization"` and pass their own workspace readiness state.

`TeamSettingsPage` provides the reusable team invitation page for operator
templates. It uses `OperatorAdminShellProvider`'s `VoyantReactProvider` for API
base URL/fetcher resolution and the operator admin message provider for labels;
pass the `api` prop only when an app needs a custom invitation transport.

## License

Apache-2.0
