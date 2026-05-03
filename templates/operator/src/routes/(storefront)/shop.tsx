import { createFileRoute, Link } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"

/**
 * Simulated storefront landing page. Real storefronts plug a
 * catalog browser here (`@voyantjs/catalog-react`'s
 * `useCatalogSearch` + `<CatalogSearchPage />`) — for the
 * dual-surface validation we just need an entry point that links
 * into the public booking journey.
 */
export const Route = createFileRoute("/(storefront)/shop")({
  component: StorefrontIndex,
})

function StorefrontIndex(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Browse and book</h1>
        <p className="text-muted-foreground">
          Customer-facing booking journey. Demoed against the same engine the operator uses —
          dispatched via <code>/v1/public/catalog/*</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How to demo the storefront flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            The storefront mounts the same <code>&lt;BookingJourney /&gt;</code> shell as the
            operator surface, just with <code>surface="public"</code>, B2C defaults, and no CRM
            picker. From here:
          </p>
          <ol className="list-inside list-decimal space-y-1">
            <li>
              Pick an owned product id from the operator's catalog (e.g. open the dashboard, copy a
              product id from the URL on the detail page).
            </li>
            <li>
              Visit <code>/shop/book/products/&lt;productId&gt;?sourceKind=owned</code>.
            </li>
            <li>
              Walk the journey end-to-end — same wizard, same engine, customer-flavored chrome.
            </li>
          </ol>
          <p>
            For real deployments the <code>(storefront)</code> route group lifts to a separate
            template; nothing else needs to change.
          </p>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        Operator?{" "}
        <Link to="/" className="underline">
          Sign in to the dashboard
        </Link>
        .
      </p>
    </div>
  )
}
