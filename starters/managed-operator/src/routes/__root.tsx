import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet, useRouteContext } from "@tanstack/react-router"
import {
  AdminRootErrorBoundary,
  AdminRootShell,
  adminRootHead,
} from "@voyant-travel/admin/app/root"
import {
  type AdminChildProvider,
  OperatorAdminShellProvider,
} from "@voyant-travel/admin/providers/operator-admin-shell"
import {
  getManagedProfileAdminApiUrl,
  managedProfileAdminFetcher,
} from "@voyant-travel/admin-app/runtime"
import { Toaster } from "@voyant-travel/ui/components"
import { TooltipProvider } from "@voyant-travel/ui/components/tooltip"

import "../styles.css"

// The CORE slice needs no domain data providers (no AvailabilityProvider): only
// the tooltip context the workspace chrome relies on.
const appProviders = [TooltipProvider] satisfies readonly AdminChildProvider[]

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () =>
    adminRootHead({
      title: "Voyant",
      description: "Voyant managed operator workspace",
      faviconHref: "/favicon.png",
    }),
  // shellComponent is always SSR'd — renders the <html> document shell.
  shellComponent: AdminRootShell,
  component: RootComponent,
  errorComponent: AdminRootErrorBoundary,
})

function RootComponent() {
  const queryClient = useRouteContext({
    from: "__root__",
    select: (context) => context.queryClient,
  })

  return (
    <OperatorAdminShellProvider
      baseUrl={getManagedProfileAdminApiUrl()}
      fetcher={managedProfileAdminFetcher}
      queryClient={queryClient}
      providers={appProviders}
    >
      <Outlet />
      <Toaster />
    </OperatorAdminShellProvider>
  )
}
