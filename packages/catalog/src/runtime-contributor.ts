import type { CatalogSearchRuntimeOptions } from "@voyant-travel/catalog/api-runtime-ports"
import {
  catalogBookingRuntimePort,
  catalogOffersRuntimePort,
  catalogSearchRuntimePort,
} from "@voyant-travel/catalog/api-runtime-ports"
import type { CatalogBookingRouteModuleOptions } from "@voyant-travel/catalog/booking-engine/operator-routes"
import {
  type CatalogIndexer,
  catalogIndexerProviderPort,
  validateCatalogIndexer,
} from "@voyant-travel/catalog/indexer/provider"
import type { CatalogOffersRouteModuleOptions } from "@voyant-travel/catalog/offers"
import {
  type CatalogContentRuntime,
  catalogContentRuntimePort,
} from "@voyant-travel/catalog/runtime-port"
import {
  type CatalogBookingSnapshotRuntimeProvider,
  type CatalogProjectionRuntimeProvider,
  catalogBookingSnapshotRuntimePort,
  catalogProjectionRuntimePort,
} from "@voyant-travel/catalog/subscriber-runtime-ports"
import {
  type VoyantRuntimeHostPrimitives,
  type VoyantWorkflowServiceContribution,
  voyantWorkflowServiceContributionsPort,
} from "@voyant-travel/core"
import type { VoyantPort } from "@voyant-travel/core/project"
import {
  type FinanceOperatorSettingsRuntime,
  financeOperatorSettingsRuntimePort,
} from "@voyant-travel/finance/runtime-port"
import {
  CATALOG_DRAFT_REAPER_RUNTIME_KEY,
  createCatalogDraftReaperRuntime,
} from "./draft-reaper-workflow.js"
import { createCatalogRuntime } from "./runtime.js"
import {
  type CatalogAccommodationsRuntimeExtension,
  type CatalogChartersRuntimeExtension,
  type CatalogCommerceRuntimeExtension,
  type CatalogCruisesRuntimeExtension,
  type CatalogDistributionRuntimeExtension,
  type CatalogInventoryRuntimeExtension,
  type CatalogOperationsRuntimeExtension,
  type CatalogRuntimeServices,
  catalogAccommodationsRuntimeExtensionPort,
  catalogChartersRuntimeExtensionPort,
  catalogCommerceRuntimeExtensionPort,
  catalogCruisesRuntimeExtensionPort,
  catalogDistributionRuntimeExtensionPort,
  catalogInventoryRuntimeExtensionPort,
  catalogOperationsRuntimeExtensionPort,
  catalogRuntimeServicesPort,
} from "./runtime-contracts.js"

type RuntimePortValue<T> = T | Promise<T>
const CRUISES_ROUTES_RUNTIME_PORT_ID = "cruises.routes-runtime"

export interface CatalogRuntimePortContribution {
  search: RuntimePortValue<CatalogSearchRuntimeOptions>
  booking: RuntimePortValue<CatalogBookingRouteModuleOptions>
  offers: RuntimePortValue<CatalogOffersRouteModuleOptions>
  content: RuntimePortValue<CatalogContentRuntime>
  projection: RuntimePortValue<CatalogProjectionRuntimeProvider>
  bookingSnapshot: RuntimePortValue<CatalogBookingSnapshotRuntimeProvider>
  services: RuntimePortValue<CatalogRuntimeServices>
}

export interface CatalogRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  hasRuntimePort?(port: Pick<VoyantPort<unknown>, "id">): boolean
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}

export function createCatalogRuntimePortContribution(
  host: CatalogRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const hasIndexerPort = host.hasRuntimePort?.(catalogIndexerProviderPort) === true
  const contribution = Promise.resolve()
    .then(() =>
      Promise.all([
        host.getRuntimePort<CatalogAccommodationsRuntimeExtension>(
          catalogAccommodationsRuntimeExtensionPort,
        ),
        host.getRuntimePort<CatalogChartersRuntimeExtension>(catalogChartersRuntimeExtensionPort),
        host.getRuntimePort<CatalogCommerceRuntimeExtension>(catalogCommerceRuntimeExtensionPort),
        host.getRuntimePort<CatalogDistributionRuntimeExtension>(
          catalogDistributionRuntimeExtensionPort,
        ),
        host.getRuntimePort<CatalogCruisesRuntimeExtension>(catalogCruisesRuntimeExtensionPort),
        host.getRuntimePort<CatalogInventoryRuntimeExtension>(catalogInventoryRuntimeExtensionPort),
        host.getRuntimePort<CatalogOperationsRuntimeExtension>(
          catalogOperationsRuntimeExtensionPort,
        ),
        host.getRuntimePort<FinanceOperatorSettingsRuntime>(financeOperatorSettingsRuntimePort),
        hasIndexerPort ? host.getRuntimePort<unknown>(catalogIndexerProviderPort) : undefined,
      ]),
    )
    .then(
      ([
        accommodations,
        charters,
        commerce,
        distribution,
        cruises,
        inventory,
        operations,
        settings,
        indexer,
      ]) => {
        let catalogIndexer: CatalogIndexer | undefined
        if (hasIndexerPort) {
          validateCatalogIndexer(indexer)
          catalogIndexer = indexer
        }
        return createCatalogRuntime(
          host.primitives,
          {
            accommodations,
            charters,
            commerce,
            distribution,
            cruises,
            inventory,
            operations,
          },
          settings,
          { indexer: catalogIndexer },
        )
      },
    )
  const cruisesRoutes = {
    resolveSourceAdapterRegistry: async (bindings: unknown) => {
      const runtime = await contribution
      const services = await runtime.services
      return services.ensureSourceRegistry(host.primitives.env(bindings))
    },
  }
  return {
    [catalogSearchRuntimePort.id]: contribution.then((runtime) => runtime.search),
    [catalogBookingRuntimePort.id]: contribution.then((runtime) => runtime.booking),
    [catalogOffersRuntimePort.id]: contribution.then((runtime) => runtime.offers),
    [catalogContentRuntimePort.id]: contribution.then((runtime) => runtime.content),
    [catalogProjectionRuntimePort.id]: contribution.then((runtime) => runtime.projection),
    [catalogBookingSnapshotRuntimePort.id]: contribution.then((runtime) => runtime.bookingSnapshot),
    [catalogRuntimeServicesPort.id]: contribution.then((runtime) => runtime.services),
    [voyantWorkflowServiceContributionsPort.id]: {
      serviceId: CATALOG_DRAFT_REAPER_RUNTIME_KEY,
      async create(context) {
        const runtime = await contribution
        const services = await runtime.services
        return createCatalogDraftReaperRuntime({
          withDb: (operation) => operation(host.primitives.database.resolve(context.environment)),
          resolveSourceRegistry: () => services.ensureSourceRegistry(context.environment),
          resolveOwnedHandlers: () => services.getOwnedHandlers(context.environment),
          reportFailure: (error, details) => context.reportFailure(error, details),
        })
      },
    } satisfies VoyantWorkflowServiceContribution,
    [CRUISES_ROUTES_RUNTIME_PORT_ID]: cruisesRoutes,
  }
}
