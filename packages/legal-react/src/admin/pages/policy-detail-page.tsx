import type { AdminRoutePageProps } from "@voyantjs/admin"

import { PolicyDetailHost } from "../policy-detail-host.js"

/**
 * Route page for the `legal-policies-detail` contribution: binds the
 * matched route's `$id` param onto {@link PolicyDetailHost}.
 */
export default function PolicyDetailPage({ params }: AdminRoutePageProps) {
  return <PolicyDetailHost id={params.id ?? ""} />
}
