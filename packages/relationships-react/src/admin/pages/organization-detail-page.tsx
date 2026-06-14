import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { OrganizationDetailHost } from "../organization-detail-host.js"

/**
 * Param-taking page for the `relationships-organizations-detail` contribution: reads
 * the organization id off {@link AdminRoutePageProps} and binds it onto the
 * packaged host. Resolved lazily through the contribution's `page` loader so
 * the detail page lands in its own chunk.
 */
export default function OrganizationDetailPage({ params }: AdminRoutePageProps) {
  return <OrganizationDetailHost id={params.id ?? ""} />
}
