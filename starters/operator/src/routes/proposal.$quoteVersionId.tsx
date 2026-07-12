import { createFileRoute } from "@tanstack/react-router"
import { PublicProposalPage } from "@voyant-travel/quotes-react/storefront"
import { useStorefrontMessages } from "@voyant-travel/storefront-react/storefront"

import { getApiUrl } from "@/lib/env"
import { OperatorStorefrontMessagesProvider } from "@/lib/storefront-messages"

export const Route = createFileRoute("/proposal/$quoteVersionId")({
  component: ProposalRoute,
})

function ProposalRoute() {
  return (
    <OperatorStorefrontMessagesProvider>
      <ProposalRouteAdapter />
    </OperatorStorefrontMessagesProvider>
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
