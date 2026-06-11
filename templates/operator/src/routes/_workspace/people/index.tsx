import { createFileRoute } from "@tanstack/react-router"
import { getPeopleQueryOptions } from "@voyantjs/crm-react"
import { PeopleHost, PeopleListSkeleton } from "@voyantjs/crm-ui/admin"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// Thin host for the package-delivered people list (packaged-admin RFC
// Phase 3). Page and navigation (semantic destinations, RFC §4.7) are
// package-owned; `PeopleHost` is zero-prop, so it mounts directly.
// `fetcher: operatorFetcher` forwards the request cookie on SSR (the default
// fetcher would 401 on direct loads).
export const Route = createFileRoute("/_workspace/people/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getPeopleQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
        { limit: 25, offset: 0 },
      ),
    ),
  pendingComponent: PeopleListSkeleton,
  component: PeopleHost,
})
