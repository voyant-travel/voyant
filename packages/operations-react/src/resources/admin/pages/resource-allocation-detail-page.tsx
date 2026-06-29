import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { ResourceAllocationDetailHost } from "../detail-hosts.js"

/**
 * Param-taking page for the `resources-allocation-detail` contribution:
 * reads the allocation id off {@link AdminRoutePageProps} and binds it onto
 * the packaged host. Resolved lazily through the contribution's `page`
 * loader so the detail page lands in its own chunk.
 */
// fallow-ignore-next-line unused-export
export default function ResourceAllocationDetailRoutePage({ params }: AdminRoutePageProps) {
  return <ResourceAllocationDetailHost id={params.id ?? ""} />
}
