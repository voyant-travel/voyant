"use client"

import { useQuery } from "@tanstack/react-query"
import {
  useAdminBreadcrumbs,
  useAdminHref,
  useAdminNavigate,
  useOperatorAdminMessages,
} from "@voyantjs/admin"
import {
  AvailabilityStartTimeDetailPage,
  getAvailabilityStartTimeDetailQueryOptions,
} from "../components/availability-start-time-detail-page.js"
import { useVoyantAvailabilityContext } from "../index.js"

export interface AvailabilityStartTimeDetailHostProps {
  /** The availability start time id (route param, bound by the host route file). */
  startTimeId: string
}

/**
 * Packaged admin host for the availability start time detail page
 * (packaged-admin RFC Phase 3). Data wiring runs through the shared
 * availability provider context; breadcrumbs through the admin chrome;
 * cross-route links through the semantic destinations
 * `availabilitySlot.list`, `availabilitySlot.detail` and `product.detail`
 * (RFC §4.7). The SSR prefetch loader stays in the host route file with the
 * app's cookie-forwarding fetcher.
 */
export function AvailabilityStartTimeDetailHost({
  startTimeId,
}: AvailabilityStartTimeDetailHostProps) {
  const messages = useOperatorAdminMessages()
  const resolveHref = useAdminHref()
  const navigateTo = useAdminNavigate()
  const client = useVoyantAvailabilityContext()
  const startTimeQuery = useQuery(getAvailabilityStartTimeDetailQueryOptions(client, startTimeId))
  const startTime = startTimeQuery.data?.data

  const startTimeFallback = messages.availability.details.startTime.fallbackTitle

  useAdminBreadcrumbs([
    { label: messages.availability.title, href: resolveHref("availabilitySlot.list", {}) },
    ...(startTime
      ? [
          {
            label: startTime.label
              ? `${startTime.productName ?? startTimeFallback} · ${startTime.label}`
              : (startTime.productName ?? `${startTimeFallback} ${startTime.startTimeLocal}`),
          },
        ]
      : []),
  ])

  return (
    <AvailabilityStartTimeDetailPage
      id={startTimeId}
      onBack={() => navigateTo("availabilitySlot.list", {})}
      onDeleted={() => navigateTo("availabilitySlot.list", {})}
      onOpenProduct={(productId) => navigateTo("product.detail", { productId })}
      onOpenSlot={(slotId) => navigateTo("availabilitySlot.detail", { slotId })}
    />
  )
}
