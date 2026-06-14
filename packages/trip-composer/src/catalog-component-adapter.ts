import {
  type BookingDraftV1,
  bookingDraftV1,
  type TravelerEntryV1,
} from "@voyantjs/catalog/booking-engine/contracts"

import type { TripComponent } from "./schema.js"
import { TripComposerInvariantError } from "./service.js"

export interface CatalogComponentBookingDraftOverrides {
  configure?: Partial<BookingDraftV1["configure"]>
  billing?: Partial<BookingDraftV1["billing"]>
  travelers?: TravelerEntryV1[]
  accommodation?: BookingDraftV1["accommodation"]
  addons?: BookingDraftV1["addons"]
  payment?: Partial<BookingDraftV1["payment"]>
  promotionCode?: string
  internalNotes?: string
  customerNotes?: string
}

export function isCatalogBackedTripComponent(
  component: Pick<TripComponent, "kind" | "entityModule" | "entityId" | "sourceKind">,
): boolean {
  return Boolean(
    component.kind === "catalog_booking" &&
      component.entityModule &&
      component.entityId &&
      component.sourceKind,
  )
}

export function toBookingDraftV1(
  component: Pick<
    TripComponent,
    "kind" | "entityModule" | "entityId" | "sourceKind" | "sourceConnectionId" | "sourceRef"
  >,
  overrides: CatalogComponentBookingDraftOverrides = {},
): BookingDraftV1 {
  if (!isCatalogBackedTripComponent(component)) {
    throw new TripComposerInvariantError(
      "Trip component cannot be mapped to a booking draft without catalog entity refs",
    )
  }

  return bookingDraftV1.parse({
    entity: {
      module: component.entityModule,
      id: component.entityId,
      sourceKind: component.sourceKind,
      sourceConnectionId: component.sourceConnectionId ?? undefined,
      sourceRef: component.sourceRef ?? undefined,
    },
    configure: {
      pax: {},
      ...overrides.configure,
    },
    billing: overrides.billing,
    travelers: overrides.travelers,
    accommodation: overrides.accommodation,
    addons: overrides.addons,
    payment: overrides.payment,
    promotionCode: overrides.promotionCode,
    internalNotes: overrides.internalNotes,
    customerNotes: overrides.customerNotes,
  })
}
