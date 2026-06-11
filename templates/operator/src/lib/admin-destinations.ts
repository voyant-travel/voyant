import type { AdminDestinationResolvers } from "@voyantjs/admin"
// Type-only: binds the `AdminDestinations` augmentations (the bookings +
// catalog destination keys) into this program without pulling the admin
// bundles into the workspace-chrome chunk.
import type {} from "@voyantjs/bookings-ui/admin"
import type {} from "@voyantjs/catalog-ui/admin"

/**
 * Operator resolver map for the semantic-destination contract (packaged-admin
 * RFC §4.7). Packaged pages navigate by `AdminDestinations` key through
 * `useAdminHref`/`useAdminNavigate`; this map is where the operator pins each
 * key to its route. `satisfies AdminDestinationResolvers` keeps it exhaustive:
 * mounting a package that declares a new destination fails the typecheck here
 * until the key is resolvable.
 *
 * Hrefs must match what the routes' typed `navigate` calls produced before
 * the contract existed — paths embed encoded params, search params keep the
 * journey schema's key order, and `undefined` values are omitted (key
 * presence is meaningful to the journey).
 */
export const operatorAdminDestinations = {
  "availabilitySlot.detail": ({ slotId }) => `/availability/${encodeURIComponent(slotId)}`,
  "booking.create": () => "/bookings/new",
  "booking.detail": ({ bookingId, tab }) =>
    `/bookings/${encodeURIComponent(bookingId)}${searchString({ tab })}`,
  "booking.list": () => "/bookings",
  "bookingJourney.start": ({ entityModule, entityId, ...search }) =>
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
  "catalog.browse": ({ surface }) => `/catalog/${surface}`,
  "catalog.detail": ({ surface, id, adults, nights }) =>
    `/catalog/${surface}/${encodeURIComponent(id)}${searchString({ adults, nights })}`,
  "invoice.detail": ({ invoiceId }) => `/finance/invoices/${encodeURIComponent(invoiceId)}`,
  "organization.detail": ({ organizationId }) =>
    `/organizations/${encodeURIComponent(organizationId)}`,
  "payment.detail": ({ paymentId }) => `/finance/payments/${encodeURIComponent(paymentId)}`,
  "person.detail": ({ personId }) => `/people/${encodeURIComponent(personId)}`,
  "product.detail": ({ productId }) => `/products/${encodeURIComponent(productId)}`,
  "supplier.detail": ({ supplierId }) => `/suppliers/${encodeURIComponent(supplierId)}`,
} satisfies AdminDestinationResolvers

/**
 * Query string with `undefined` entries omitted, in insertion order.
 * `encodeURIComponent` round-trips through the router's search parser, so a
 * destination href navigated via `router.navigate({ href })` commits the same
 * location the old typed `navigate({ to, params, search })` calls produced.
 */
function searchString(params: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.length > 0 ? `?${parts.join("&")}` : ""
}
