import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { AvailabilitySlotDetailHost } from "../slot-detail-host.js"

/**
 * Param-taking page for the `availability-slot-detail` contribution: reads
 * the slot id off {@link AdminRoutePageProps} and binds it onto the packaged
 * host. Resolved lazily through the contribution's `page` loader so the
 * detail page lands in its own chunk.
 */
export default function AvailabilitySlotDetailRoutePage({ params }: AdminRoutePageProps) {
  return <AvailabilitySlotDetailHost slotId={params.id ?? ""} />
}
