"use client"

import {
  AdminWidgetSlotRenderer,
  resolveAdminWidgets,
  useAdminExtensions,
  useAdminNavigate,
} from "@voyantjs/admin"

import { PersonDetailPage } from "../components/person-detail-page.js"
import { type PersonDetailBookingsTabContext, personDetailBookingsTabSlot } from "./slots.js"

// The slot id + its context type live in `./slots.js` — a lean,
// component-free module — so other domains' admin extension factories
// (evaluated with workspace chrome) can import them without pulling this
// host into the entry chunk. Re-exported here for backwards compatibility.
export { type PersonDetailBookingsTabContext, personDetailBookingsTabSlot }

export interface PersonDetailHostProps {
  id: string
}

/**
 * Packaged admin host for the canonical `PersonDetailPage` (packaged-admin
 * RFC Phase 3). Owns everything package-clean:
 *
 *   - Cross-route links resolve through semantic destinations (RFC §4.7):
 *     `person.list` (back / after delete), `person.detail` (relationships),
 *     `organization.detail` — no host route tree import.
 *   - The Bookings tab mounts whenever a widget contribution targets
 *     {@link personDetailBookingsTabSlot} (the bookings-ui ↔ crm-ui cycle
 *     resolution: bookings-ui depends on this package, so the bookings list
 *     card travels the widget seam, not an import).
 */
export function PersonDetailHost({ id }: PersonDetailHostProps) {
  const navigateTo = useAdminNavigate()
  const adminExtensions = useAdminExtensions()
  const hasBookingsTabWidgets =
    resolveAdminWidgets({ slot: personDetailBookingsTabSlot, extensions: adminExtensions }).length >
    0

  return (
    <PersonDetailPage
      id={id}
      onBack={() => navigateTo("person.list", {})}
      onDeleted={() => navigateTo("person.list", {})}
      onOrganizationOpen={(organizationId) => navigateTo("organization.detail", { organizationId })}
      onPersonOpen={(personId) => navigateTo("person.detail", { personId })}
      slots={
        hasBookingsTabWidgets
          ? {
              bookingsTab: {
                content: (
                  <AdminWidgetSlotRenderer
                    slot={personDetailBookingsTabSlot}
                    props={{ personId: id } satisfies PersonDetailBookingsTabContext}
                  />
                ),
              },
            }
          : undefined
      }
    />
  )
}
