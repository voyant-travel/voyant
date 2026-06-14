"use client"

import { useQuery } from "@tanstack/react-query"
import {
  useAdminBreadcrumbs,
  useAdminHref,
  useAdminNavigate,
  useOperatorAdminMessages,
} from "@voyantjs/admin"
import {
  AvailabilityRuleDetailPage,
  getAvailabilityRuleDetailQueryOptions,
} from "../components/availability-rule-detail-page.js"
import { useVoyantAvailabilityContext } from "../index.js"

export interface AvailabilityRuleDetailHostProps {
  /** The availability rule id (route param, bound by the host route file). */
  ruleId: string
}

/**
 * Packaged admin host for the availability rule detail page (packaged-admin
 * RFC Phase 3). Data wiring runs through the shared availability provider
 * context; breadcrumbs through the admin chrome; cross-route links through
 * the semantic destinations `availabilitySlot.list`, `availabilitySlot.detail`
 * and `product.detail` (RFC §4.7). The SSR prefetch loader stays in the host
 * route file with the app's cookie-forwarding fetcher.
 */
export function AvailabilityRuleDetailHost({ ruleId }: AvailabilityRuleDetailHostProps) {
  const messages = useOperatorAdminMessages()
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()
  const client = useVoyantAvailabilityContext()
  const ruleQuery = useQuery(getAvailabilityRuleDetailQueryOptions(client, ruleId))
  const rule = ruleQuery.data?.data

  useAdminBreadcrumbs([
    { label: messages.availability.title, href: resolveHref("availabilitySlot.list", {}) },
    ...(rule ? [{ label: rule.productName ?? `Rule ${rule.id.slice(-6)}` }] : []),
  ])

  return (
    <AvailabilityRuleDetailPage
      id={ruleId}
      onBack={() => navigateTo("availabilitySlot.list", {})}
      onDeleted={() => navigateTo("availabilitySlot.list", {})}
      onOpenProduct={(productId) => navigateTo("product.detail", { productId })}
      onOpenSlot={(slotId) => navigateTo("availabilitySlot.detail", { slotId })}
    />
  )
}
