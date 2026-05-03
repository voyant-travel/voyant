import { createFileRoute } from "@tanstack/react-router"

import { ChannelSyncPage } from "@/components/voyant/channel-sync/channel-sync-page"

export const Route = createFileRoute("/_workspace/channel-sync")({
  component: ChannelSyncPage,
})
