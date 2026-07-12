import type { AdminDestinationResolvers, AdminExtension } from "@voyant-travel/admin"
import { buildAdminExtensionDestinations } from "@voyant-travel/admin/app"

function searchString(params: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.length > 0 ? `?${parts.join("&")}` : ""
}

/**
 * Build selected-graph and project-local destinations, then add the standard
 * host-owned resolvers that cannot be derived from one route contribution.
 */
export function createAdminHostDestinations(
  extensions: ReadonlyArray<AdminExtension>,
): AdminDestinationResolvers {
  const generated = buildAdminExtensionDestinations(extensions)
  return {
    ...generated,
    "booking.detail": ({ bookingId, tab }: { bookingId: string; tab?: string }) =>
      `/bookings/${encodeURIComponent(bookingId)}${searchString({ tab })}`,
    "bookingJourney.start": ({
      entityModule,
      entityId,
      ...search
    }: {
      entityModule: string
      entityId: string
      sourceKind?: string
      sourceConnectionId?: string
      sourceRef?: string
      departureId?: string
      departureDate?: string
      optionId?: string
      roomTypeId?: string
      ratePlanId?: string
      board?: string
      entityName?: string
      entityImageUrl?: string
    }) =>
      `/catalog/journey/${encodeURIComponent(entityModule)}/${encodeURIComponent(entityId)}${searchString(
        {
          sourceKind: search.sourceKind,
          sourceConnectionId: search.sourceConnectionId,
          sourceRef: search.sourceRef,
          departureId: search.departureId,
          departureDate: search.departureDate,
          optionId: search.optionId,
          roomTypeId: search.roomTypeId,
          ratePlanId: search.ratePlanId,
          board: search.board,
          entityName: search.entityName,
          entityImageUrl: search.entityImageUrl,
        },
      )}`,
    "catalog.browse": ({ surface }: { surface: string }) => `/catalog/${surface}`,
    "catalog.detail": ({
      surface,
      id,
      adults,
      nights,
    }: {
      surface: string
      id: string
      adults?: number
      nights?: number
    }) => `/catalog/${surface}/${encodeURIComponent(id)}${searchString({ adults, nights })}`,
    "flightBooking.start": ({
      offerId,
      returnOfferId,
      adults,
      children,
      infants,
      cabin,
    }: {
      offerId: string
      returnOfferId?: string
      adults?: number
      children?: number
      infants?: number
      cabin?: string
    }) =>
      `/flights/book/${encodeURIComponent(offerId)}${searchString({
        return: returnOfferId,
        pax_a: adults,
        pax_c: children,
        pax_i: infants,
        cabin,
      })}`,
    "legal.home": () => "/legal",
    "product.detail": ({ productId }: { productId: string }) =>
      `/products/${encodeURIComponent(productId)}`,
    "trip.create": () => "/trips/new",
  } as AdminDestinationResolvers
}
