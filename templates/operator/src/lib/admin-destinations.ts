import type { AdminDestinationResolvers } from "@voyantjs/admin"
// Type-only: binds the `AdminDestinations` augmentations (the availability +
// bookings + catalog + crm + finance + legal + suppliers destination keys)
// into this program without pulling the admin bundles into the
// workspace-chrome chunk.
import type {} from "@voyantjs/availability-ui/admin"
// Type-only: binds the `AdminDestinations` augmentations (the bookings +
// catalog + crm + finance + legal + resources + suppliers destination keys)
// into this program without pulling the admin bundles into the
// workspace-chrome chunk.
// catalog + crm + finance + legal + notifications + suppliers destination keys) into this
// program without
// pulling the admin bundles into the workspace-chrome chunk.
import type {} from "@voyantjs/bookings-ui/admin"
import type {} from "@voyantjs/catalog-react/admin"
import type {} from "@voyantjs/crm-ui/admin"
import type {} from "@voyantjs/finance-ui/admin"
import type {} from "@voyantjs/legal-ui/admin"
import type {} from "@voyantjs/notifications-ui/admin"
import type {} from "@voyantjs/resources-ui/admin"
import type {} from "@voyantjs/suppliers-ui/admin"

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
  "availabilitySlot.list": () => "/availability",
  "availabilityStartTime.detail": ({ startTimeId }) =>
    `/availability/start-times/${encodeURIComponent(startTimeId)}`,
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
  "contract.detail": ({ contractId }) => `/legal/contracts/${encodeURIComponent(contractId)}`,
  "contract.list": () => "/legal/contracts",
  "contractTemplate.detail": ({ templateId }) =>
    `/legal/templates/${encodeURIComponent(templateId)}`,
  "contractTemplate.list": () => "/legal/templates",
  "invoice.detail": ({ invoiceId }) => `/finance/invoices/${encodeURIComponent(invoiceId)}`,
  "invoice.list": () => "/finance/invoices",
  "legal.home": () => "/legal",
  "notificationReminderRule.detail": ({ ruleId }) =>
    `/notifications/reminder-rules/${encodeURIComponent(ruleId)}`,
  "notificationReminderRule.list": () => "/notifications/reminder-rules",
  "notificationTemplate.detail": ({ templateId }) =>
    `/notifications/templates/${encodeURIComponent(templateId)}`,
  "notificationTemplate.list": () => "/notifications/templates",
  "organization.detail": ({ organizationId }) =>
    `/organizations/${encodeURIComponent(organizationId)}`,
  "organization.list": () => "/organizations",
  "payment.detail": ({ paymentId }) => `/finance/payments/${encodeURIComponent(paymentId)}`,
  "payment.list": () => "/finance/payments",
  "person.detail": ({ personId }) => `/people/${encodeURIComponent(personId)}`,
  "person.list": () => "/people",
  "policy.detail": ({ policyId }) => `/legal/policies/${encodeURIComponent(policyId)}`,
  "policy.list": () => "/legal/policies",
  "product.detail": ({ productId }) => `/products/${encodeURIComponent(productId)}`,
  "resource.detail": ({ resourceId }) => `/resources/${encodeURIComponent(resourceId)}`,
  "resource.list": () => "/resources",
  "resourceAllocation.detail": ({ allocationId }) =>
    `/resources/allocations/${encodeURIComponent(allocationId)}`,
  "resourceAssignment.detail": ({ assignmentId }) =>
    `/resources/assignments/${encodeURIComponent(assignmentId)}`,
  "resourcePool.detail": ({ poolId }) => `/resources/pools/${encodeURIComponent(poolId)}`,
  "supplier.detail": ({ supplierId }) => `/suppliers/${encodeURIComponent(supplierId)}`,
  "supplier.list": () => "/suppliers",
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
