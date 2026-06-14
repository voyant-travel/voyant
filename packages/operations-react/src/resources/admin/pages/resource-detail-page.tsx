import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { ResourceDetailHost } from "../detail-hosts.js"

/**
 * Param-taking page for the `resources-detail` contribution: reads the
 * resource id off {@link AdminRoutePageProps} and binds it onto the packaged
 * host. Resolved lazily through the contribution's `page` loader so the
 * detail page lands in its own chunk.
 */
export default function ResourceDetailRoutePage({ params }: AdminRoutePageProps) {
  return <ResourceDetailHost id={params.id ?? ""} />
}
