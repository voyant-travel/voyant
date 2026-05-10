import { createFileRoute } from "@tanstack/react-router"
import { ChannelSyncPage } from "@voyantjs/distribution-ui"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/channel-sync")({
  component: ChannelSyncRoute,
})

function ChannelSyncRoute() {
  return <ChannelSyncPage baseUrl={getApiUrl()} />
}
