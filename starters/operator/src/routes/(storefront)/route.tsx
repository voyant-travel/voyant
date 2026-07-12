import { createFileRoute, Outlet } from "@tanstack/react-router"
import {
  CustomerAccountProvider,
  StorefrontScopeProvider,
  StorefrontShell,
} from "@voyant-travel/storefront-react/storefront"

import { authClient } from "@/lib/auth"
import { getApiUrl } from "@/lib/env"
import { OperatorStorefrontMessagesProvider } from "@/lib/storefront-messages"
import { operatorFetcher } from "@/lib/voyant-fetcher"

/**
 * `(storefront)` — simulated customer-facing surface inside the
 * operator starter. No auth gate; no workspace chrome.
 *
 * A production deployment would lift this group + the storefront
 * components into a separate starter; the seam is intentionally
 * small so the move is mechanical.
 */
export const Route = createFileRoute("/(storefront)")({
  component: StorefrontLayout,
})

function StorefrontLayout(): React.ReactElement {
  return (
    <OperatorStorefrontMessagesProvider>
      <StorefrontScopeProvider>
        <CustomerAccountProvider baseUrl={getApiUrl()} fetcher={operatorFetcher}>
          <StorefrontChrome />
        </CustomerAccountProvider>
      </StorefrontScopeProvider>
    </OperatorStorefrontMessagesProvider>
  )
}

function StorefrontChrome(): React.ReactElement {
  const { data: session, isPending } = authClient.useSession()

  return (
    <StorefrontShell signedIn={Boolean(session)} sessionPending={isPending}>
      <Outlet />
    </StorefrontShell>
  )
}
