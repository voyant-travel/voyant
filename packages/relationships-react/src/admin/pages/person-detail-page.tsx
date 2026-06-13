import type { AdminRoutePageProps } from "@voyantjs/admin"

import { PersonDetailHost } from "../person-detail-host.js"

/**
 * Param-taking page for the `relationships-people-detail` contribution: reads the
 * person id off {@link AdminRoutePageProps} and binds it onto the packaged
 * host. Resolved lazily through the contribution's `page` loader so the
 * detail page lands in its own chunk.
 */
export default function PersonDetailPage({ params }: AdminRoutePageProps) {
  return <PersonDetailHost id={params.id ?? ""} />
}
