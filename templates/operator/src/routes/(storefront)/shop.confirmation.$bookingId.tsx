import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"

/**
 * Post-commit confirmation page for the storefront flow.
 *
 * Real deployments would render the booking summary here pulled
 * from `/v1/public/bookings/$id` (or a public confirmation
 * endpoint) — for the dual-surface validation, just acknowledging
 * the commit is sufficient.
 */
export const Route = createFileRoute("/(storefront)/shop/confirmation/$bookingId")({
  component: ShopConfirmationRouteComponent,
})

function ShopConfirmationRouteComponent(): React.ReactElement {
  const { bookingId } = useParams({ from: "/(storefront)/shop/confirmation/$bookingId" })
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Booking confirmed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Booking reference: <code>{bookingId}</code>
          </p>
          <p className="text-muted-foreground text-sm">
            We've placed a hold on your reservation. You'll receive a confirmation email shortly
            with the next steps.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
          >
            Back to storefront
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
