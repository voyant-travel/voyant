import { createFileRoute } from "@tanstack/react-router"
import {
  ensureResourcesPageData,
  ResourcesHost,
  ResourcesPageSkeleton,
} from "@voyantjs/resources-ui/admin"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// operatorFetcher so SSR loaders forward the request cookie.
const resourcesClient = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

// Tab dashboard — the packaged loader awaits only the default tab's query
// and fires the rest as background prefetches (same filters as the page's
// hooks, so the cache seeds line up). Page + dialogs are the packaged
// ResourcesHost from @voyantjs/resources-ui/admin.
export const Route = createFileRoute("/_workspace/resources/")({
  ssr: "data-only",
  loader: ({ context }) => ensureResourcesPageData(context.queryClient, resourcesClient),
  pendingComponent: ResourcesPageSkeleton,
  component: ResourcesHost,
})
