import { createIndexerService } from "@voyant-travel/catalog"
import {
  type CatalogRuntimeServices,
  catalogCruisesRuntimeExtensionPort,
  catalogRuntimeServicesPort,
} from "@voyant-travel/catalog/runtime-contracts"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  type FinanceCruisesPaymentPolicyRuntime,
  financeCruisesPaymentPolicyRuntimePort,
} from "@voyant-travel/finance/runtime-port"

import { catalogCruisesRuntimeExtension } from "./catalog-runtime-extension.js"
import { cruisesExternalRefreshJobRuntimePort } from "./external-refresh-job.js"
import {
  resolveCruiseBookingPaymentPolicy,
  resolveCruiseEntityPaymentPolicy,
  resolveCruiseSupplierId,
} from "./payment-policy-runtime.js"
import { refreshExternalCruiseCatalog } from "./service-external-refresh.js"

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
    [cruisesExternalRefreshJobRuntimePort.id]: {
      async run() {
        const environment = host.primitives.env(undefined)
        const rawDb = host.primitives.database.resolve<AnyDrizzleDb>(undefined)
        const catalogRuntime = await host.getRuntimePort<CatalogRuntimeServices>(
          catalogRuntimeServicesPort,
        )
        const embeddings = catalogRuntime.buildEmbeddingProvider(environment)
        const indexer = catalogRuntime.buildIndexer(environment, embeddings)
        if (!indexer) return refreshExternalCruiseCatalog({ db: rawDb as never })

        const indexerService = createIndexerService({
          adapter: indexer,
          slices: await catalogRuntime.loadSlices(rawDb),
          registries: catalogRuntime.fieldPolicyRegistries(),
        })
        await indexerService.ensureCollections()
        return refreshExternalCruiseCatalog({
          db: rawDb as never,
          sourceAdapterRegistry: await catalogRuntime.ensureSourceRegistry(environment),
          indexerService,
          fieldPolicyRegistries: catalogRuntime.fieldPolicyRegistries(),
          wrapCatalogBuilder: (builder) => catalogRuntime.withEmbedding(builder, embeddings),
          onCatalogProgress: (event) =>
            console.info("[external-cruise-refresh] catalog page", event),
        })
      },
    },
  }
}
