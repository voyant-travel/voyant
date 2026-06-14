import type { Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import {
  createTripComposerRoutes,
  type TripComposerRoutesOptions,
  tripComposerRoutes,
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
export type { TripComposerRoutes, TripComposerRoutesOptions } from "./routes.js"
export { createTripComposerRoutes } from "./routes.js"

export const tripComposerModule: Module = {
  name: "trip-composer",
}

export const tripComposerHonoModule: HonoModule = {
  module: tripComposerModule,
  adminRoutes: tripComposerRoutes,
}

export interface TripComposerHonoModuleOptions extends TripComposerRoutesOptions {
  publicRoutes?: boolean
}

export function createTripComposerHonoModule(options: TripComposerHonoModuleOptions = {}) {
  const { publicRoutes = false, ...routeOptions } = options
  const routes = createTripComposerRoutes({ ...routeOptions, surface: "admin" })
  const honoModule: HonoModule = {
    module: tripComposerModule,
    adminRoutes: routes,
  }
  if (publicRoutes) {
    honoModule.publicRoutes = createTripComposerRoutes({ ...routeOptions, surface: "public" })
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
export {
  type CreateTripArgs,
  createTripTool,
  type PriceTripArgs,
  priceTripTool,
  type ReserveTripArgs,
  type ReviseTripArgs,
  reserveTripTool,
  reviseTripTool,
  type TripComposerMcpServices,
  tripComposerMcpTools,
} from "./mcp-tools.js"
export { tripComposerRoutes } from "./routes.js"
export type {
  NewTripComponent,
  NewTripComponentEvent,
  NewTripEnvelope,
  NewTripReservationPlan,
  NewTripSnapshot,
  TripComponent,
  TripComponentEvent,
  TripComponentPricingSnapshot,
  TripComponentTaxLineSnapshot,
  TripEnvelope,
  TripEnvelopePricingSnapshot,
  TripReservationPlan,
  TripReservationPlanCompensationSnapshot,
  TripReservationPlanComponentSnapshot,
  TripReservationPlanFailureSnapshot,
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
  TripComposerInvariantError,
  type TripListResult,
  type TripReservationPlanComponentKind,
  taxLinesFromBreakdown,
  tripComposerService,
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
  type TripComposerHealthCheck,
  type TripComposerStatus,
  type TripEnvelopeStatus,
  type TripsListSortDir,
  type TripsListSortField,
  tripComponentEventTypeSchema,
  tripComponentKindSchema,
  tripComponentPricingSnapshotSchema,
  tripComponentStatusSchema,
  tripComponentStatusTransitionSchema,
  tripComponentTaxLineSchema,
  tripComposerHealthCheckSchema,
  tripComposerStatusSchema,
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
