import { createFileRoute, Link, Outlet } from "@tanstack/react-router"

import { StorefrontMessagesProvider, useStorefrontMessages } from "@/lib/storefront-i18n"
import { StorefrontScopeProvider } from "@/lib/storefront-scope"
import { StorefrontMarketSelector } from "./storefront-market-selector"

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
    <StorefrontMessagesProvider>
      <StorefrontScopeProvider>
        <StorefrontChrome />
      </StorefrontScopeProvider>
    </StorefrontMessagesProvider>
  )
}

function StorefrontChrome(): React.ReactElement {
  const t = useStorefrontMessages().layout

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/shop" className="font-medium">
            {t.brand}
          </Link>
          {/*
           * No customer "Sign in" link in the storefront chrome on purpose.
           * Customer accounts don't exist yet (#2621), and the operator
           * `/sign-in` surface is the workspace/admin auth path — presenting it
           * in customer chrome implied an account system while actually dropping
           * customers into operator auth. The trip composer
           * (`shop_.composer.tsx`) keeps its own intentional operator-session
           * sign-in prompt for the simulated storefront (#2642); that gate is a
           * separate operator affordance, not a customer account entry point.
           */}
          <nav className="flex items-center gap-2">
            <StorefrontMarketSelector />
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
