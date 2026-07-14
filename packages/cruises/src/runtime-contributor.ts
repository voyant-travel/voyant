import { createIndexerService } from "@voyant-travel/catalog"
import {
  type CatalogRuntimeServices,
  catalogCruisesRuntimeExtensionPort,
  catalogRuntimeServicesPort,
} from "@voyant-travel/catalog/runtime-contracts"
import {
  type VoyantRuntimeHostPrimitives,
  type VoyantWorkflowServiceContribution,
  voyantWorkflowServiceContributionsPort,
} from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  type FinanceCruisesPaymentPolicyRuntime,
  financeCruisesPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"

import { catalogCruisesRuntimeExtension } from "./catalog-runtime-extension.js"
import {
  CRUISES_EXTERNAL_REFRESH_RUNTIME_KEY,
  createCruisesExternalRefreshWorkflowRuntime,
} from "./external-refresh-workflow.js"
import {
  resolveCruiseBookingPaymentPolicy,
  resolveCruiseEntityPaymentPolicy,
  resolveCruiseSupplierId,
} from "./payment-policy-runtime.js"

/** Provide Cruises' narrow Catalog and Finance runtime contracts. */
export interface CruisesRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  getRuntimePort<T>(port: { id: string }): T | Promise<T>
}

export function createCruisesRuntimePortContribution(
  host: CruisesRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [catalogCruisesRuntimeExtensionPort.id]: catalogCruisesRuntimeExtension,
    [financeCruisesPaymentPolicyRuntimePort.id]: {
      resolveBookingPolicy: resolveCruiseBookingPaymentPolicy,
      resolveEntityPolicy: resolveCruiseEntityPaymentPolicy,
      resolveSupplierId: resolveCruiseSupplierId,
    } satisfies FinanceCruisesPaymentPolicyRuntime,
    [voyantWorkflowServiceContributionsPort.id]: {
      serviceId: CRUISES_EXTERNAL_REFRESH_RUNTIME_KEY,
      create(context) {
        return createCruisesExternalRefreshWorkflowRuntime({
          withOptions: async (operation) => {
            const rawDb = host.primitives.database.resolve<AnyDrizzleDb>(context.environment)
            const catalogRuntime = await host.getRuntimePort<CatalogRuntimeServices>(
              catalogRuntimeServicesPort,
            )
            const embeddings = catalogRuntime.buildEmbeddingProvider(context.environment)
            const indexer = catalogRuntime.buildIndexer(context.environment, embeddings)
            if (!indexer) return operation({ db: rawDb as never })

            const indexerService = createIndexerService({
              adapter: indexer,
              slices: await catalogRuntime.loadSlices(rawDb),
              registries: catalogRuntime.fieldPolicyRegistries(),
            })
            await indexerService.ensureCollections()
            return operation({
              db: rawDb as never,
              sourceAdapterRegistry: await catalogRuntime.ensureSourceRegistry(context.environment),
              indexerService,
              fieldPolicyRegistries: catalogRuntime.fieldPolicyRegistries(),
              wrapCatalogBuilder: (builder) => catalogRuntime.withEmbedding(builder, embeddings),
              onCatalogProgress: (event) =>
                console.info("[external-cruise-refresh] catalog page", event),
            })
          },
        })
      },
    } satisfies VoyantWorkflowServiceContribution,
  }
}
