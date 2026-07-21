import { definePort } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import type { OwnedBookingHandlerRegistry, SourceAdapterRegistry } from "./booking-engine/index.js"

export interface CatalogDraftReaperJobRuntime {
  withDb<T>(operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
  resolveSourceRegistry(): SourceAdapterRegistry | Promise<SourceAdapterRegistry>
  resolveOwnedHandlers(): OwnedBookingHandlerRegistry | Promise<OwnedBookingHandlerRegistry>
  reportFailure(error: unknown, context: { draftId: string; op: string }): void
  now?(): number
}

export const catalogDraftReaperJobRuntimePort = definePort<CatalogDraftReaperJobRuntime>({
  id: "catalog.draft-reaper-job",
  test(runtime) {
    if (
      !runtime ||
      typeof runtime.withDb !== "function" ||
      typeof runtime.resolveSourceRegistry !== "function" ||
      typeof runtime.resolveOwnedHandlers !== "function" ||
      typeof runtime.reportFailure !== "function"
    ) {
      throw new Error("catalog.draft-reaper-job provider is incomplete.")
    }
  },
})
