import { createFileRoute } from "@tanstack/react-router"
import {
  AvailabilityIndexHost,
  ensureAvailabilityPageData,
} from "@voyantjs/availability-react/admin"
import { AvailabilityPageSkeleton } from "@voyantjs/availability-react/ui"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// operatorFetcher so SSR loaders forward the request cookie.
const availabilityClient = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

// Slots dashboard — the packaged loader awaits only what the slots tab +
// the products picker need for first paint and prefetches the slot dialog's
// rules/start-times dimensions in the background. Page, bulk batch
// mutations and navigation (semantic destinations, RFC §4.7) are the
// packaged AvailabilityIndexHost from @voyantjs/availability-react/admin.
export const Route = createFileRoute("/_workspace/availability/")({
  ssr: "data-only",
  loader: ({ context }) => ensureAvailabilityPageData(context.queryClient, availabilityClient),
  pendingComponent: AvailabilityPageSkeleton,
  component: AvailabilityIndexHost,
})
