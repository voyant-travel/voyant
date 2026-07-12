import { OpenAPIHono } from "@hono/zod-openapi"
import type { Module } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { openApiValidationHook, stampOpenApiRegistryApiId } from "@voyant-travel/hono"
import type { HonoModule } from "@voyant-travel/hono/module"
import {
  buildContractsRouteRuntime,
  CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY,
} from "./contracts/route-runtime.js"
import {
  type ContractsRouteOptions,
  createContractsAdminRoutes,
  createContractsPublicRoutes,
} from "./contracts/routes.js"
import type { AutoGenerateContractOptions } from "./contracts/service-auto-generate.js"
import { legalLinkable } from "./linkables.js"
import { policiesAdminRoutes, policiesPublicRoutes } from "./policies/routes.js"
import { legalRuntimePort } from "./runtime-port.js"
import { legalTermsAdminRoutes, legalTermsPublicRoutes } from "./terms/routes.js"

export { legalLinkable } from "./linkables.js"

export const legalModule: Module = {
  name: "legal",
  linkable: legalLinkable,
  requiresTransactionalDb: true,
}

export interface CreateLegalHonoModuleOptions extends ContractsRouteOptions {
  /**
   * Required when `autoGenerateContractOnConfirmed.enabled` is true. The
   * `booking.confirmed` subscriber fires outside request scope, so it
   * needs its own db handle from runtime bindings. Returns `AnyDrizzleDb`
   * (the `PostgresJsDatabase | NeonHttpDatabase` union from
   * `@voyant-travel/db`) so consumers don't need to cast through `unknown` when
   * wiring a Hyperdrive/Neon client.
   */
  resolveDb?: (bindings: Record<string, unknown>) => AnyDrizzleDb
  /**
   * Opt-in auto-generate on `booking.confirmed`. When enabled + a
   * `templateSlug` is supplied + a `documentGenerator` is resolvable, every
   * booking.confirmed event creates a contract against the template's
   * current version and generates its attachment via the configured
   * generator (R2-backed PDF, etc.).
   */
  autoGenerateContractOnConfirmed?: AutoGenerateContractOptions
}

export function createLegalHonoModule(options: CreateLegalHonoModuleOptions = {}): HonoModule {
  // Parents are `OpenAPIHono` so the contracts/policies/terms sub-chains'
  // `.openapi()` operations propagate up into the framework/operator OpenAPI
  // registries (voyant#2114). The shared `openApiValidationHook` is the
  // `defaultHook`.
  const legalAdminRoutes = new OpenAPIHono({ defaultHook: openApiValidationHook })
    .route("/contracts", createContractsAdminRoutes(options))
    .route("/policies", policiesAdminRoutes)
    .route("/terms", legalTermsAdminRoutes)

  const legalPublicRoutes = stampOpenApiRegistryApiId(
    new OpenAPIHono({ defaultHook: openApiValidationHook })
      .route("/contracts", createContractsPublicRoutes(options))
      .route("/policies", policiesPublicRoutes)
      .route("/terms", legalTermsPublicRoutes),
    "@voyant-travel/legal#api.public",
  )

  const module: Module = {
    ...legalModule,
    bootstrap: ({ bindings, container, eventBus }) => {
      const bindingsRecord = bindings as Record<string, unknown>
      const contractsRuntime = buildContractsRouteRuntime(bindingsRecord, options)
      contractsRuntime.eventBus ??= eventBus
      container.register(CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY, contractsRuntime)
    },
  }

  return {
    module,
    adminRoutes: legalAdminRoutes,
    publicRoutes: legalPublicRoutes,
  }
}

export const legalHonoModule: HonoModule = createLegalHonoModule()

/** Package-owned adapter from the graph port registry to the public module factory. */
export const createLegalVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) =>
  createLegalHonoModule(await getPort(legalRuntimePort)),
)

export {
  CONTRACT_DOCUMENT_ROUTE_PATHS,
  type ContractDocumentRoutesOptions,
  type ContractDocumentStorageLike,
  createContractDocumentHonoModule,
  createContractDocumentRoutes,
  createContractDocumentVoyantRuntime,
} from "./contract-document-routes.js"
export { legalContractDocumentRuntimePort } from "./contract-document-runtime-port.js"
export {
  createLegalBookingContractSubscriberDescriptor,
  LEGAL_BOOKING_CONTRACT_SUBSCRIBER_ID,
  LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY,
  type LegalBookingConfirmedEvent,
  type LegalBookingContractSubscriberDependencies,
  type LegalBookingContractSubscriberHost,
  type LegalBookingContractSubscriberRuntime,
  legalBookingContractConfirmedSubscriber,
  legalBookingContractSubscriberRuntimePort,
  registerLegalBookingContractSubscriberRuntime,
} from "./contracts/booking-contract-subscriber-runtime.js"
export {
  type ContractDocumentService,
  type ContractDocumentServiceOptions,
  createContractDocumentService,
  ensureDefaultContractSeries,
  resetContractDocumentForBooking,
} from "./contracts/contract-document-service.js"
export {
  buildContractVariableBindings,
  type ContractOperatorPaymentInstructions,
  type ContractOperatorProfile,
  type ContractVariableBindingsOptions,
} from "./contracts/contract-variables.js"
export * from "./contracts/index.js"
export {
  buildContractsRouteRuntime,
  CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY,
  type ContractsRouteRuntime,
} from "./contracts/route-runtime.js"
export type { ContractsRouteOptions } from "./contracts/routes.js"
export {
  type AutoGenerateContractOptions,
  type AutoGenerateContractResult,
  type AutoGenerateContractRuntime,
  autoGenerateContractForBooking,
  type BookingConfirmedLikeEvent,
  type DefaultContractVariables,
  type GenerateContractForBookingResult,
  generateContractForBookingFromDefaults,
  type ResolveContractVariablesFn,
} from "./contracts/service-auto-generate.js"
export * from "./policies/index.js"
export { legalRuntimePort } from "./runtime-port.js"
export * from "./terms/index.js"
