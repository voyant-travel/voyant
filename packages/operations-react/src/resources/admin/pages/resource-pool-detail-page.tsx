import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { ResourcePoolDetailHost } from "../detail-hosts.js"

/**
 * Param-taking page for the `resources-pool-detail` contribution: reads the
 * pool id off {@link AdminRoutePageProps} and binds it onto the packaged
 * host. Resolved lazily through the contribution's `page` loader so the
 * detail page lands in its own chunk.
 */
// fallow-ignore-next-line unused-export
export default function ResourcePoolDetailRoutePage({ params }: AdminRoutePageProps) {
  return <ResourcePoolDetailHost id={params.id ?? ""} />
}
