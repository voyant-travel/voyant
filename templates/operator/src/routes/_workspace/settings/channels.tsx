import { createFileRoute } from "@tanstack/react-router"
import { getChannelsQueryOptions } from "@voyantjs/distribution-react"
import { ChannelsPage } from "@voyantjs/distribution-ui"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/settings/channels")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getChannelsQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  component: ChannelsPage,
})
