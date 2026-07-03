import { createFileRoute, Link, Outlet } from "@tanstack/react-router"
import { buttonVariants } from "@voyant-travel/ui/components/button"
import { cn } from "@voyant-travel/ui/lib/utils"
import { CircleUserRound, LogIn } from "lucide-react"

import { authClient } from "@/lib/auth"
import { CustomerAccountProvider } from "@/lib/customer-account"
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
        <CustomerAccountProvider>
          <StorefrontChrome />
        </CustomerAccountProvider>
      </StorefrontScopeProvider>
    </StorefrontMessagesProvider>
  )
}

function StorefrontChrome(): React.ReactElement {
  const t = useStorefrontMessages().layout
  const { data: session, isPending } = authClient.useSession()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/shop" className="font-medium">
            {t.brand}
          </Link>
          <nav className="flex items-center gap-2">
            <StorefrontMarketSelector />
            <Link
              to={session ? "/shop/account" : "/shop/account/sign-in"}
              search={session ? undefined : { next: "/shop/account" }}
              aria-disabled={isPending}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                isPending && "pointer-events-none opacity-50",
              )}
            >
              {session ? (
                <CircleUserRound className="size-4" aria-hidden="true" />
              ) : (
                <LogIn className="size-4" aria-hidden="true" />
              )}
              {session ? "Account" : "Sign in"}
            </Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
