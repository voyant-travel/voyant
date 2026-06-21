import type { Module } from "@voyant-travel/core"
import type { HonoModule } from "@voyant-travel/hono/module"

import { createTripsRoutes, type TripsRoutesOptions, tripsRoutes } from "./routes.js"

export {
  type CatalogAdapterContext,
  type CatalogComponentAdapter,
  type CatalogComponentAdapterOptions,
  createCatalogComponentAdapter,
  previewCancellation,
  type StartComponentCheckout,
} from "./catalog-component.js"
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
export {
  createFlightComponentAdapter,
  type FlightAdapterContext,
  type FlightComponentAdapter,
  type FlightComponentAdapterApi,
  type FlightComponentAdapterOptions,
} from "./flight-component.js"
export type { TripsRoutes, TripsRoutesOptions } from "./routes.js"
export { createTripsRoutes } from "./routes.js"

export const tripsModule: Module = {
  name: "trips",
}

export const tripsHonoModule: HonoModule = {
  module: tripsModule,
  adminRoutes: tripsRoutes,
}

export interface TripsHonoModuleOptions extends TripsRoutesOptions {
  publicRoutes?: boolean
}

export function createTripsHonoModule(options: TripsHonoModuleOptions = {}) {
  const { publicRoutes = false, ...routeOptions } = options
  const routes = createTripsRoutes({ ...routeOptions, surface: "admin" })
  const honoModule: HonoModule = {
    module: tripsModule,
    adminRoutes: routes,
  }
  if (publicRoutes) {
    honoModule.publicRoutes = createTripsRoutes({ ...routeOptions, surface: "public" })
  }
  return honoModule
}

export type {
  McpToolContent,
  McpToolContext,
  McpToolDefinition,
  McpToolErrorCode,
  McpToolHandler,
  McpToolResult,
} from "./mcp-contract.js"
export { McpToolError } from "./mcp-contract.js"
export {
  type CreateMcpToolRegistryOptions,
  createMcpToolRegistry,
  enforceAudienceAuthorization,
  type McpToolListEntry,
  type McpToolRegistry,
  requireService,
} from "./mcp-registry.js"
export { createTripMcpRoutes, type TripMcpRoutesOptions } from "./mcp-routes.js"
export {
  type CreateTripArgs,
  createTripTool,
  type PriceTripArgs,
  priceTripTool,
  type ReserveTripArgs,
  type ReviseTripArgs,
  reserveTripTool,
  reviseTripTool,
  type TripsMcpServices,
  tripsMcpTools,
} from "./mcp-tools.js"
export { tripsRoutes } from "./routes.js"
export type {
  NewTripCandidate,
  NewTripComponent,
  NewTripComponentEvent,
  NewTripEnvelope,
  NewTripRequirement,
  NewTripReservationPlan,
  NewTripSnapshot,
  TripCandidate,
  TripComponent,
  TripComponentEvent,
  TripComponentPricingSnapshot,
  TripComponentTaxLineSnapshot,
  TripEnvelope,
  TripEnvelopePricingSnapshot,
  TripRequirement,
  TripReservationPlan,
  TripReservationPlanCompensationSnapshot,
  TripReservationPlanComponentSnapshot,
  TripReservationPlanFailureSnapshot,
  TripSnapshot,
  TripSnapshotProposal,
  TripSnapshotProposalLine,
} from "./schema.js"
export {
  tripCandidateStatusEnum,
  tripCandidates,
  tripComponentEvents,
  tripComponentEventTypeEnum,
  tripComponentKindEnum,
  tripComponentStatusEnum,
  tripComponents,
  tripEnvelopeStatusEnum,
  tripEnvelopes,
  tripRequirementStatusEnum,
  tripRequirements,
  tripReservationPlanStatusEnum,
  tripReservationPlans,
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
  type SubmitTripReservationPlanComponent,
  type SubmitTripReservationPlanInput,
  type SubmitTripReservationPlanResult,
  shouldReplayCheckout,
  shouldReplayReserve,
  type Trip,
  type TripCancellationPreviewResult,
  type TripCheckoutInput,
  type TripCheckoutResult,
  type TripListResult,
  type TripReservationPlanComponentKind,
  TripsInvariantError,
  taxLinesFromBreakdown,
  tripsService,
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
  type TripComponentEventType,
  type TripComponentKind,
  type TripComponentStatus,
  type TripEnvelopeStatus,
  type TripsHealthCheck,
  type TripsListSortDir,
  type TripsListSortField,
  type TripsStatus,
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
  tripsHealthCheckSchema,
  tripsListSortDirSchema,
  tripsListSortFieldSchema,
  tripsStatusSchema,
  type UpdateTripComponentInput,
  updateTripComponentRefsSchema,
  updateTripComponentSchema,
  updateTripEnvelopeSchema,
} from "./validation.js"
