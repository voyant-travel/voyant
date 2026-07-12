import { createFileRoute } from "@tanstack/react-router"
import { StorefrontConfirmationPage } from "@voyant-travel/storefront-react/storefront"
import { z } from "zod"
import { getApiUrl } from "@/lib/env"

const confirmationSearchSchema = z.object({
  kind: z.enum(["card_pending", "bank_transfer", "inquiry", "hold"]).optional(),
  session: z.string().optional(),
  orderId: z.string().optional(),
  ref: z.string().optional(),
})

export const Route = createFileRoute("/(storefront)/shop_/confirmation/$bookingId")({
  component: ConfirmationRoute,
  validateSearch: confirmationSearchSchema,
})

function ConfirmationRoute(): React.ReactElement {
  const { bookingId } = Route.useParams()
  const search = Route.useSearch()
  return (
    <StorefrontConfirmationPage
      apiUrl={getApiUrl()}
      bookingId={bookingId}
      kind={search.kind}
      paymentRef={search.session ?? search.orderId ?? search.ref}
    />
  )
}
