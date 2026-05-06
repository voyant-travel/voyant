"use client"

import { useFacility } from "@voyantjs/facilities-react"
import { Badge } from "@voyantjs/ui/components/badge"

import { useFacilitiesUiMessagesOrDefault } from "../i18n/provider.js"

type Props = {
  facilityId: string | null | undefined
  /**
   * Override the rendered label (e.g. preloaded from a parent record).
   * When supplied (including the empty string), the component renders that
   * label directly and skips the lookup query.
   */
  label?: string | null
  className?: string
}

export function FacilityBadge({ facilityId, label, className }: Props) {
  const messages = useFacilitiesUiMessagesOrDefault()

  if (!facilityId) {
    return (
      <Badge className={className} variant="outline">
        {messages.common.none}
      </Badge>
    )
  }

  if (label !== undefined) {
    return (
      <Badge className={className} variant="outline">
        {label || messages.facilityBadge.missing}
      </Badge>
    )
  }

  return <FetchedFacilityBadge facilityId={facilityId} className={className} />
}

function FetchedFacilityBadge({
  facilityId,
  className,
}: {
  facilityId: string
  className?: string
}) {
  const messages = useFacilitiesUiMessagesOrDefault()
  const facilityQuery = useFacility(facilityId)

  const resolvedLabel =
    facilityQuery.data?.name ??
    (facilityQuery.isPending ? messages.common.loading : messages.facilityBadge.missing)

  return (
    <Badge className={className} variant="outline">
      {resolvedLabel}
    </Badge>
  )
}
