import { createFileRoute } from "@tanstack/react-router"
import { QuoteVersionsPage } from "@voyantjs/crm-ui"
import { getQuoteVersionsQueryOptions } from "@/components/voyant/crm/crm-query-options"

export const Route = createFileRoute("/_workspace/quotes/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(getQuoteVersionsQueryOptions({ limit: 100 })),
  component: QuotesRoute,
})

function QuotesRoute() {
  return <QuoteVersionsPage />
}
