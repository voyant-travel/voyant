import type { AdminRoutePageProps } from "@voyantjs/admin"

import { SupplierDetailHost } from "../supplier-detail-host.js"

/**
 * Param-taking page for the `suppliers-detail` contribution: reads the
 * supplier id off {@link AdminRoutePageProps} and binds it onto the packaged
 * host. Resolved lazily through the contribution's `page` loader so the
 * detail page lands in its own chunk.
 */
export default function SupplierDetailPage({ params }: AdminRoutePageProps) {
  return <SupplierDetailHost id={params.id ?? ""} />
}
