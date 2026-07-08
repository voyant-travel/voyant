import type { Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"
import { bookingsLinkable } from "./linkables.js"
import {
  BOOKING_ROUTE_RUNTIME_CONTAINER_KEY,
  type BookingRouteRuntimeOptions,
  buildBookingRouteRuntime,
} from "./route-runtime.js"
import { bookingRoutes } from "./routes.js"
import { publicBookingRoutes } from "./routes-public.js"

export {
  BOOKING_ACTION_LEDGER_CAPABILITIES,
  BOOKING_PII_READ_CAPABILITY,
  BOOKING_STATUS_CAPABILITIES,
  bookingActionLedgerCapabilityRegistry,
} from "./action-ledger-capabilities.js"
export { bookingsSupplierExtension } from "./extensions/suppliers.js"
export { bookingLinkable, bookingsLinkable } from "./linkables.js"
export {
  type BookingPiiAuditEvent,
  type BookingPiiService,
  type BookingPiiServiceOptions,
  createBookingPiiService,
  type UpsertBookingTravelerTravelDetailInput,
} from "./pii.js"
export {
  type PiiAccessContext,
  redactBookingContact,
  redactEmail,
  redactPhone,
  redactString,
  redactTravelerIdentity,
  shouldRevealBookingPii,
} from "./pii-redaction.js"
export * from "./requirements/index.js"
export {
  type BookingReservationPlanCompensation,
  type BookingReservationPlanFailure,
  type BookingReservationPlanLine,
  type BookingReservationPlanLineContext,
  type BookingReservationPlanLineKind,
  type BookingReservationPlanLineResult,
  type BookingReservationPlanOrigin,
  type BookingReservationPlanReleaseResult,
  type BookingReservationPlanStatus,
  type SubmitBookingReservationPlanInput,
  type SubmitBookingReservationPlanResult,
  type SubmitBookingReservationPlanRuntime,
  type SubmittedBookingReservationPlanLine,
  submitBookingReservationPlan,
} from "./reservation-plans.js"
export type {
  BookingCancelledEvent,
  BookingConfirmedEvent,
  BookingTravelerSharingGroupMember,
  BookingTravelerSharingGroupSummary,
  ConvertProductData,
  CreateTravelerWithTravelDetailsInput,
  UpdateTravelerWithTravelDetailsInput,
} from "./service.js"
export { bookingsService } from "./service.js"
export {
  type AddBookingGroupMemberInput,
  type BookingGroupListQuery,
  type BookingGroupMemberWithBooking,
  bookingGroupsService,
  type CreateBookingGroupInput,
  listGroupBookingTravelers,
  type UpdateBookingGroupInput,
} from "./service-groups.js"
export {
  type CatalogReservationBookingOriginInput,
  type DirectB2CBookingOriginInput,
  type DirectB2CBookingOriginItemInput,
  getBookingOriginByBookingId,
  toCatalogReservationBookingOriginInput,
  toDirectB2CBookingOriginInput,
  type UpsertBookingOriginInput,
  upsertBookingOrigin,
} from "./service-origin.js"
export {
  BOOKING_TRANSITIONS,
  type BookingStatus,
  type BookingStatusPatch,
  BookingTransitionError,
  canTransitionBooking,
  transitionBooking,
} from "./state-machine.js"
export {
  BOOKING_RESOURCE_AVAILABILITY_STATUSES,
  BOOKING_RESOURCE_CAPACITY_STATUSES,
  isBookingResourceAvailabilityStatus,
} from "./status.js"
export {
  type BookingStatusDispatchTarget,
  dispatchBookingStatusChange,
} from "./status-dispatch.js"
export {
  type ExpireStaleBookingHoldsInput,
  type ExpireStaleBookingHoldsResult,
  expireStaleBookingHolds,
} from "./tasks/index.js"

export const bookingsModule: Module = {
  name: "bookings",
  linkable: bookingsLinkable,
  requiresTransactionalDb: true,
}

export interface BookingsHonoModuleOptions extends BookingRouteRuntimeOptions {}

export function createBookingsHonoModule(options: BookingsHonoModuleOptions = {}): HonoModule {
  const module: Module = {
    ...bookingsModule,
    bootstrap: ({ bindings, container }) => {
      container.register(
        BOOKING_ROUTE_RUNTIME_CONTAINER_KEY,
        buildBookingRouteRuntime(bindings as Record<string, unknown>, options),
      )
    },
  }

  return {
    module,
    adminRoutes: bookingRoutes,
    publicRoutes: publicBookingRoutes,
  }
}

export const bookingsHonoModule: HonoModule = createBookingsHonoModule()

export type {
  BookingOverviewEnricherItem,
  BookingOverviewItemEnricher,
  BookingPersonResolverContact,
  BookingRouteRuntime,
  BookingRouteRuntimeOptions,
  ClosePaymentSchedulesForBooking,
  RecordCancellationFinancialSettlement,
  ResolveBookingBillingOrganizationById,
  ResolveBookingBillingPerson,
  ResolveBookingBillingPersonById,
  ResolveBookingKmsProvider,
  ResolveBookingTravelerPerson,
  ResolveBookingTravelSnapshot,
} from "./route-runtime.js"
export {
  BOOKING_ROUTE_RUNTIME_CONTAINER_KEY,
  buildBookingRouteRuntime,
} from "./route-runtime.js"
export type { BookingActionLedgerListResponse, BookingRoutes } from "./routes.js"
export type { PublicBookingRoutes } from "./routes-public.js"
export { publicBookingRoutes } from "./routes-public.js"
export type {
  BookingTravelerBedPreference,
  BookingTravelerDietary,
  BookingTravelerIdentity,
  BookingTravelerTravelDetail,
  DecryptedBookingTravelerTravelDetail,
  NewBookingTravelerTravelDetail,
  TravelerAllocationMap,
} from "./schema/travel-details.js"
export {
  bookingTravelerBedPreferenceSchema,
  bookingTravelerDietarySchema,
  bookingTravelerIdentitySchema,
  bookingTravelerTravelDetailInsertSchema,
  bookingTravelerTravelDetailSelectSchema,
  bookingTravelerTravelDetails,
  bookingTravelerTravelDetailUpdateSchema,
  decryptedBookingTravelerTravelDetailSchema,
  travelerAllocationMapSchema,
} from "./schema/travel-details.js"
export type {
  Booking,
  BookingActivity,
  BookingAllocation,
  BookingDocument,
  BookingFulfillment,
  BookingGroup,
  BookingGroupMember,
  BookingItem,
  BookingItemTraveler,
  BookingNote,
  BookingOrigin,
  BookingOriginLegacyTransactionIds,
  BookingOriginSource,
  BookingPiiAccessLog,
  BookingPriceOverride,
  BookingRedemptionEvent,
  BookingSessionState,
  BookingStaffAssignment,
  BookingSupplierStatus,
  BookingTraveler,
  NewBooking,
  NewBookingActivity,
  NewBookingAllocation,
  NewBookingDocument,
  NewBookingFulfillment,
  NewBookingGroup,
  NewBookingGroupMember,
  NewBookingItem,
  NewBookingItemTraveler,
  NewBookingNote,
  NewBookingOrigin,
  NewBookingPiiAccessLog,
  NewBookingRedemptionEvent,
  NewBookingSessionState,
  NewBookingStaffAssignment,
  NewBookingSupplierStatus,
  NewBookingTraveler,
} from "./schema.js"
export {
  bookingActivityLog,
  bookingAllocations,
  bookingDocuments,
  bookingFulfillments,
  bookingGroupKindEnum,
  bookingGroupMemberRoleEnum,
  bookingGroupMembers,
  bookingGroups,
  bookingItems,
  bookingItemTravelers,
  bookingNotes,
  bookingOriginSources,
  bookingOrigins,
  bookingPiiAccessLog,
  bookingRedemptionEvents,
  bookingSessionStates,
  bookingStaffAssignments,
  bookingSupplierStatuses,
  bookings,
  bookingTravelers,
} from "./schema.js"
export {
  type PublicBookingsServiceResolvers,
  publicBookingsService,
  resolveSessionPricingSnapshot,
} from "./service-public.js"
export {
  addBookingGroupMemberSchema,
  bookingGroupKindSchema,
  bookingGroupListQuerySchema,
  bookingGroupMemberRoleSchema,
  bookingListQuerySchema,
  bookingPriceOverrideSchema,
  cancelBookingSchema,
  completeBookingSchema,
  confirmBookingSchema,
  convertProductSchema,
  createBookingSchema,
  createTravelerWithTravelDetailsSchema,
  expireBookingSchema,
  expireStaleBookingsSchema,
  extendBookingHoldSchema,
  insertBookingAllocationSchema,
  insertBookingDocumentSchema,
  insertBookingFulfillmentSchema,
  insertBookingGroupSchema,
  insertBookingItemSchema,
  insertBookingItemTravelerSchema,
  insertBookingNoteSchema,
  insertBookingSchema,
  insertBookingTravelerDocumentSchema,
  insertSupplierStatusSchema,
  insertTravelerSchema,
  internalBookingOverviewLookupQuerySchema,
  overrideBookingStatusSchema,
  pricingPreviewSchema,
  publicBookingOverviewAccessQuerySchema,
  publicBookingOverviewLookupQuerySchema,
  publicBookingSessionMutationSchema,
  publicBookingSessionRepriceItemSchema,
  publicBookingSessionRepriceResultSchema,
  publicBookingSessionRepriceSummarySchema,
  publicBookingSessionStateSchema,
  publicCreateBookingSessionSchema,
  publicGuestBookingAccessSchema,
  publicGuestBookingLookupResponseSchema,
  publicGuestBookingLookupSchema,
  publicRepriceBookingSessionSchema,
  publicUpdateBookingSessionSchema,
  publicUpsertBookingSessionStateSchema,
  recordBookingRedemptionSchema,
  reserveBookingSchema,
  sharingGroupsForSlotQuerySchema,
  startBookingSchema,
  updateBookingAllocationSchema,
  updateBookingFulfillmentSchema,
  updateBookingGroupSchema,
  updateBookingItemSchema,
  updateBookingSchema,
  updateSupplierStatusSchema,
  updateTravelerSchema,
  updateTravelerWithTravelDetailsSchema,
  upsertTravelerTravelDetailsSchema,
} from "./validation.js"
