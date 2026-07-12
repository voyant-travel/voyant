import { createFileRoute } from "@tanstack/react-router"
import { PublicProposalPage } from "@voyant-travel/quotes-react/storefront"

import { getApiUrl } from "@/lib/env"
import { StorefrontMessagesProvider, useStorefrontMessages } from "@/lib/storefront-i18n"

export const Route = createFileRoute("/proposal/$quoteVersionId")({
  component: ProposalRoute,
})

function ProposalRoute() {
  return (
    <StorefrontMessagesProvider>
      <ProposalRouteAdapter />
    </StorefrontMessagesProvider>
  )
}

function ProposalRouteAdapter() {
  const { quoteVersionId } = Route.useParams()
  const messages = useStorefrontMessages().proposal
  return (
    <PublicProposalPage
      quoteVersionId={quoteVersionId}
      apiBaseUrl={getApiUrl()}
      messages={messages}
    />
  )
}
