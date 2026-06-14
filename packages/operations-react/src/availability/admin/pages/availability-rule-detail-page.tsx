import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { AvailabilityRuleDetailHost } from "../rule-detail-host.js"

/**
 * Param-taking page for the `availability-rule-detail` contribution: reads
 * the rule id off {@link AdminRoutePageProps} and binds it onto the packaged
 * host. Resolved lazily through the contribution's `page` loader so the
 * detail page lands in its own chunk.
 */
export default function AvailabilityRuleDetailRoutePage({ params }: AdminRoutePageProps) {
  return <AvailabilityRuleDetailHost ruleId={params.id ?? ""} />
}
