import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { AvailabilityStartTimeDetailHost } from "../start-time-detail-host.js"

/**
 * Param-taking page for the `availability-start-time-detail` contribution:
 * reads the start time id off {@link AdminRoutePageProps} and binds it onto
 * the packaged host. Resolved lazily through the contribution's `page`
 * loader so the detail page lands in its own chunk.
 */
export default function AvailabilityStartTimeDetailRoutePage({ params }: AdminRoutePageProps) {
  return <AvailabilityStartTimeDetailHost startTimeId={params.id ?? ""} />
}
