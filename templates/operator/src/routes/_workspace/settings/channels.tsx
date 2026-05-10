import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getChannelsQueryOptions } from "@voyantjs/distribution-react"
import { ChannelsPage } from "@voyantjs/distribution-ui"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/settings/channels")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getChannelsQueryOptions(
        { baseUrl: getApiUrl(), fetcher: defaultFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  component: ChannelsPage,
})
