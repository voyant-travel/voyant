import { createFileRoute } from "@tanstack/react-router"
import { getSuppliersQueryOptions } from "@voyantjs/suppliers-react"
import { SuppliersHost, SuppliersListSkeleton } from "@voyantjs/suppliers-ui/admin"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// Thin host for the package-delivered suppliers list (packaged-admin RFC
// Phase 3). Page and navigation (semantic destinations, RFC §4.7) are
// package-owned; the host takes no props, so it attaches directly as the
// route component. The loader stays app-side for the SSR prefetch
// (operatorFetcher forwards the request cookie).
export const Route = createFileRoute("/_workspace/suppliers/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getSuppliersQueryOptions({ baseUrl: getApiUrl(), fetcher: operatorFetcher }),
    ),
  pendingComponent: SuppliersListSkeleton,
  component: SuppliersHost,
})
