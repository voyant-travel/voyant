import type { IndexerService } from "@voyant-travel/catalog"
import type { SourceAdapterRegistry } from "@voyant-travel/catalog/booking-engine"
import { workflow } from "@voyant-travel/workflows"

import {
  type ExternalCruiseCatalogRefreshOptions,
  refreshExternalCruiseCatalog,
} from "./service-external-refresh.js"

export const CRUISES_EXTERNAL_REFRESH_RUNTIME_KEY = "cruises.external-refresh-runtime"

export interface CruisesExternalRefreshWorkflowRuntime {
  withOptions<T>(
    operation: (options: ExternalCruiseCatalogRefreshOptions) => Promise<T>,
  ): Promise<T>
  prepareIndexer?(options: {
    indexerService: IndexerService
    sourceAdapterRegistry?: SourceAdapterRegistry
  }): Promise<void>
}

export const cruisesExternalCatalogRefreshWorkflow = workflow({
  id: "cruises.external-catalog-refresh",
  async run(_input, ctx) {
    const runtime = ctx.services.resolve<CruisesExternalRefreshWorkflowRuntime>(
      CRUISES_EXTERNAL_REFRESH_RUNTIME_KEY,
    )
    return ctx.step("refresh-external-catalog", () =>
      runtime.withOptions(async (options) => {
        if (options.indexerService && runtime.prepareIndexer) {
          await runtime.prepareIndexer({
            indexerService: options.indexerService,
            sourceAdapterRegistry: options.sourceAdapterRegistry,
          })
        }
        return refreshExternalCruiseCatalog(options)
      }),
    )
  },
})
