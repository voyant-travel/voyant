import { createFileRoute, Link, Outlet } from "@tanstack/react-router"

/**
 * `(storefront)` — simulated customer-facing surface inside the
 * operator template. No auth gate; no workspace chrome.
 *
 * A production deployment would lift this group + the storefront
 * components into a separate template; the seam is intentionally
 * small so the move is mechanical.
 */
export const Route = createFileRoute("/(storefront)")({
  component: StorefrontLayout,
})

function StorefrontLayout(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/shop" className="font-medium">
            Voyant Storefront
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              to="/sign-in"
              className="rounded-md px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              Sign in
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
