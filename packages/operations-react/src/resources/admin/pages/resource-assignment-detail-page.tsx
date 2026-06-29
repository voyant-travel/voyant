import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { ResourceAssignmentDetailHost } from "../detail-hosts.js"

/**
 * Param-taking page for the `resources-assignment-detail` contribution:
 * reads the assignment id off {@link AdminRoutePageProps} and binds it onto
 * the packaged host. Resolved lazily through the contribution's `page`
 * loader so the detail page lands in its own chunk.
 */
// fallow-ignore-next-line unused-export
export default function ResourceAssignmentDetailRoutePage({ params }: AdminRoutePageProps) {
  return <ResourceAssignmentDetailHost id={params.id ?? ""} />
}
