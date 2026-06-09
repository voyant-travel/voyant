import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import {
  createTravelComposerRoutes,
  type TravelComposerRoutesOptions,
  travelComposerRoutes,
} from "./routes.js"

export {
  type CatalogComponentBookingDraftOverrides,
  isCatalogBackedTripComponent,
  toBookingDraftV1,
} from "./catalog-component-adapter.js"
export {
  CRUISE_EXTENSION_METADATA_KIND,
  type CruiseExtensionExtra,
  type CruiseExtensionLifecycle,
  type CruiseExtensionLinkCommand,
  type CruiseExtensionLinkInput,
  type CruiseExtensionPlacement,
  type CruiseExtensionRepresentation,
  type CruiseExtensionSelection,
  type CruiseExtensionTargetKind,
  createCruiseExtensionComponent,
  createCruiseExtensionExtra,
  createCruiseExtensionLinkCommand,
  cruiseExtensionLinkKey,
  groupCruiseExtensionLinksByProduct,
  representCruiseExtensionSelection,
} from "./cruise-extension.js"
export type { TravelComposerRoutes, TravelComposerRoutesOptions } from "./routes.js"
export { createTravelComposerRoutes } from "./routes.js"

export const travelComposerModule: Module = {
  name: "travel-composer",
}

export const travelComposerHonoModule: HonoModule = {
  module: travelComposerModule,
  adminRoutes: travelComposerRoutes,
}

export interface TravelComposerHonoModuleOptions extends TravelComposerRoutesOptions {
  publicRoutes?: boolean
}

export function createTravelComposerHonoModule(options: TravelComposerHonoModuleOptions = {}) {
  const { publicRoutes = false, ...routeOptions } = options
  const routes = createTravelComposerRoutes({ ...routeOptions, surface: "admin" })
  const honoModule: HonoModule = {
    module: travelComposerModule,
    adminRoutes: routes,
  }
  if (publicRoutes) {
    honoModule.publicRoutes = createTravelComposerRoutes({ ...routeOptions, surface: "public" })
  }
  return honoModule
}

export {
  type CreateTripArgs,
  createTripTool,
  type PriceTripArgs,
  priceTripTool,
  type ReserveTripArgs,
  type ReviseTripArgs,
  reserveTripTool,
  reviseTripTool,
  type TravelComposerMcpServices,
  travelComposerMcpTools,
} from "./mcp-tools.js"
export { travelComposerRoutes } from "./routes.js"
export type {
  NewTripComponent,
  NewTripComponentEvent,
  NewTripEnvelope,
  NewTripSnapshot,
  TripComponent,
  TripComponentEvent,
  TripComponentPricingSnapshot,
  TripComponentTaxLineSnapshot,
  TripEnvelope,
  TripEnvelopePricingSnapshot,
  TripSnapshot,
  TripSnapshotProposal,
  TripSnapshotProposalLine,
} from "./schema.js"
export {
  tripComponentEvents,
  tripComponentEventTypeEnum,
  tripComponentKindEnum,
  tripComponentStatusEnum,
  tripComponents,
  tripEnvelopeStatusEnum,
  tripEnvelopes,
  tripSnapshots,
} from "./schema.js"
export {
  aggregateComponentPricing,
  applyQuoteToComponent,
  assertTripComponentCanBeReserved,
  assertTripComponentCanBeUpdated,
  assertTripComponentCanReceiveRefs,
  assertTripComponentCanStartCheckout,
  buildTripSnapshotProposal,
  type CancelComponentInput,
  type CancelComponentResult,
  type CancelTripComponentsDeps,
  type CancelTripComponentsResult,
  type CatalogComponentQuoteInput,
  type CheckoutHandoffKind,
  type CompleteTripCheckoutInput,
  type CompleteTripCheckoutResult,
  type ComponentCancellationAction,
  type ComponentCancellationPreview,
  type ComponentCancellationPreviewInput,
  type ComponentCheckoutInput,
  type ComponentCheckoutResult,
  checkoutResultToComponentPatch,
  completeTripCheckout,
  freezeTripSnapshot,
  getTripSnapshotById,
  hasCommittedComponentReference,
  listTripSnapshots,
  type PreviewTripCancellationDeps,
  type PriceTripDeps,
  type PriceTripResult,
  pricingSnapshotFromBreakdown,
  type ReleaseReservedComponentInput,
  type ReleaseReservedComponentResult,
  type ReserveComponentInput,
  type ReserveComponentPreflightResult,
  type ReserveComponentPreflightStatus,
  type ReserveComponentResult,
  type ReserveTripDeps,
  type ReserveTripResult,
  reserveResultToComponentPatch,
  type StartCheckoutDeps,
  type StartCheckoutResult,
  type StartCheckoutTarget,
  type StartedTripComponentCheckout,
  shouldReplayCheckout,
  shouldReplayReserve,
  TravelComposerInvariantError,
  type Trip,
  type TripCancellationPreviewResult,
  type TripCheckoutInput,
  type TripCheckoutResult,
  type TripListResult,
  taxLinesFromBreakdown,
  travelComposerService,
} from "./service.js"
export {
  assertTripTravelerPartyComplete,
  validateTripTravelerParty,
} from "./traveler-party-validation.js"
export {
  type CancelTripComponentsInput,
  type CreateTripComponentBodyInput,
  type CreateTripComponentInput,
  type CreateTripEnvelopeInput,
  type CreateTripSnapshotInput,
  cancelTripComponentsSchema,
  catalogComponentReferenceSchema,
  committedComponentReferenceSchema,
  createTripComponentBodySchema,
  createTripComponentSchema,
  createTripEnvelopeSchema,
  createTripSnapshotSchema,
  isAllowedTripComponentStatusTransition,
  isTerminalTripComponentStatus,
  type ListTripsQuery,
  listTripsQuerySchema,
  type PreviewTripCancellationInput,
  type PriceTripInput,
  previewTripCancellationSchema,
  priceTripSchema,
  type ReserveTripInput,
  reorderTripComponentsSchema,
  reserveTripSchema,
  type StartTripCheckoutInput,
  startTripCheckoutSchema,
  type TravelComposerHealthCheck,
  type TravelComposerStatus,
  type TripComponentEventType,
  type TripComponentKind,
  type TripComponentStatus,
  type TripEnvelopeStatus,
  type TripsListSortDir,
  type TripsListSortField,
  travelComposerHealthCheckSchema,
  travelComposerStatusSchema,
  tripComponentEventTypeSchema,
  tripComponentKindSchema,
  tripComponentPricingSnapshotSchema,
  tripComponentStatusSchema,
  tripComponentStatusTransitionSchema,
  tripComponentTaxLineSchema,
  tripEnvelopePricingSnapshotSchema,
  tripEnvelopeStatusSchema,
  tripSnapshotProposalLineSchema,
  tripSnapshotProposalSchema,
  tripsListSortDirSchema,
  tripsListSortFieldSchema,
  type UpdateTripComponentInput,
  updateTripComponentRefsSchema,
  updateTripComponentSchema,
  updateTripEnvelopeSchema,
} from "./validation.js"
