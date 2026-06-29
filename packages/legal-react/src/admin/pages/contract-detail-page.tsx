import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { ContractDetailHost } from "../contract-detail-host.js"

/**
 * Route page for the `legal-contracts-detail` contribution: binds the
 * matched route's `$id` param onto {@link ContractDetailHost}.
 */
// fallow-ignore-next-line unused-export
export default function ContractDetailPage({ params }: AdminRoutePageProps) {
  return <ContractDetailHost id={params.id ?? ""} />
}
