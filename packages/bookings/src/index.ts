import type { LinkableDefinition, Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

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
export type {
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
  BOOKING_TRANSITIONS,
  type BookingStatus,
  type BookingStatusPatch,
  BookingTransitionError,
  canTransitionBooking,
  transitionBooking,
} from "./state-machine.js"
export {
  type BookingStatusDispatchTarget,
  dispatchBookingStatusChange,
} from "./status-dispatch.js"
export {
  type ExpireStaleBookingHoldsInput,
  type ExpireStaleBookingHoldsResult,
  expireStaleBookingHolds,
} from "./tasks/index.js"

export const bookingLinkable: LinkableDefinition = {
  module: "bookings",
  entity: "booking",
  table: "bookings",
  idPrefix: "book",
}

export const bookingsLinkable = {
  booking: bookingLinkable,
}

export const bookingsModule: Module = {
  name: "bookings",
  linkable: bookingsLinkable,
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
    routes: bookingRoutes,
  }
}

export const bookingsHonoModule: HonoModule = createBookingsHonoModule()

export type {
  BookingRouteRuntime,
  BookingRouteRuntimeOptions,
  ResolveBookingKmsProvider,
} from "./route-runtime.js"
export {
  BOOKING_ROUTE_RUNTIME_CONTAINER_KEY,
  buildBookingRouteRuntime,
} from "./route-runtime.js"
export type { BookingRoutes } from "./routes.js"
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
  bookingPiiAccessLog,
  bookingRedemptionEvents,
  bookingSessionStates,
  bookingStaffAssignments,
  bookingSupplierStatuses,
  bookings,
  bookingTravelers,
} from "./schema.js"
export { publicBookingsService, resolveSessionPricingSnapshot } from "./service-public.js"
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
  publicBookingOverviewLookupQuerySchema,
  publicBookingSessionMutationSchema,
  publicBookingSessionRepriceItemSchema,
  publicBookingSessionRepriceResultSchema,
  publicBookingSessionRepriceSummarySchema,
  publicBookingSessionStateSchema,
  publicCreateBookingSessionSchema,
  publicRepriceBookingSessionSchema,
  publicUpdateBookingSessionSchema,
  publicUpsertBookingSessionStateSchema,
  recordBookingRedemptionSchema,
  reserveBookingFromTransactionSchema,
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
