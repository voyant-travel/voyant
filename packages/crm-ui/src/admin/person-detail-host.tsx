"use client"

import {
  AdminWidgetSlotRenderer,
  resolveAdminWidgets,
  useAdminExtensions,
  useAdminNavigate,
} from "@voyantjs/admin"

import { PersonDetailPage } from "../components/person-detail-page.js"

/**
 * Widget slot rendered as the person detail page's Bookings tab
 * (packaged-admin RFC §4.7 cycle resolution): `@voyantjs/bookings-ui`
 * depends on this package, so the host cannot import the bookings-owned
 * person-bookings card directly — instead the bookings admin extension
 * contributes a widget targeting this slot and the host mounts the tab
 * whenever a contribution exists. Widgets receive
 * {@link PersonDetailBookingsTabContext} as props.
 */
export const personDetailBookingsTabSlot = "person.details.bookings-tab"

/**
 * Render context handed to widget contributions targeting
 * {@link personDetailBookingsTabSlot}.
 */
export interface PersonDetailBookingsTabContext {
  /** The person whose detail page hosts the tab. */
  personId: string
}

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
