import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { PersonDetailHost } from "../person-detail-host.js"

/**
 * Param-taking page for the `relationships-people-detail` contribution: reads the
 * person id off {@link AdminRoutePageProps} and binds it onto the packaged
 * host. Resolved lazily through the contribution's `page` loader so the
 * detail page lands in its own chunk.
 */
// fallow-ignore-next-line unused-export
export default function PersonDetailPage({ params }: AdminRoutePageProps) {
  return <PersonDetailHost id={params.id ?? ""} />
}
