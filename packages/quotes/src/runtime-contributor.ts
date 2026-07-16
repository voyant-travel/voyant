import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { VoyantPort } from "@voyant-travel/core/project"
import {
  type CustomFieldValueLifecycleRuntime,
  customFieldValueLifecycleRuntimePort,
} from "@voyant-travel/core/runtime-port"
import { checkoutInquiryRuntimePort } from "@voyant-travel/quotes-contracts/checkout-inquiry"
import type { TripsRoutesOptionsProvider } from "@voyant-travel/trips"
import { tripsRoutesRuntimePort } from "@voyant-travel/trips/voyant"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { createCheckoutInquiryRuntime } from "./checkout-inquiry-runtime.js"
import { createQuotesRuntime } from "./runtime.js"
import {
  type QuotesProposalRuntime,
  type QuotesRuntime,
  type QuotesSnapshotRuntime,
  quotesProposalRuntimePort,
  quotesRuntimePort,
  quotesSnapshotRuntimePort,
} from "./runtime-port.js"

export interface QuotesRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}

const quoteCustomFieldValues: CustomFieldValueLifecycleRuntime = {
  supports: (entityType) => entityType === "quote",
  async renameDefinitionKey(db, definition, nextKey) {
    const database = db as PostgresJsDatabase
    await database.execute(
      sql`UPDATE quotes
          SET custom_fields = jsonb_set(
            custom_fields,
            ARRAY[${definition.namespace}]::text[],
            (COALESCE(custom_fields -> ${definition.namespace}, '{}'::jsonb) - ${definition.key})
              || jsonb_build_object(
                ${nextKey}::text,
                custom_fields #> ARRAY[${definition.namespace}, ${definition.key}]::text[]
              ),
            true
          ),
          updated_at = now()
          WHERE custom_fields -> ${definition.namespace} ? ${definition.key}`,
    )
  },
  async deleteDefinitionValues(db, definition) {
    const database = db as PostgresJsDatabase
    await database.execute(
      sql`UPDATE quotes
          SET custom_fields = custom_fields #- ARRAY[${definition.namespace}, ${definition.key}]::text[],
              updated_at = now()
          WHERE custom_fields -> ${definition.namespace} ? ${definition.key}`,
    )
  },
}

/** Contribute standard Node Quotes adapters selected by the framework BOM. */
export function createQuotesRuntimePortContribution(
  host: QuotesRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const checkoutInquiry = createCheckoutInquiryRuntime()
  const runtime = Promise.resolve()
    .then(() => host.getRuntimePort<TripsRoutesOptionsProvider>(tripsRoutesRuntimePort))
    .then((tripsRoutes) => createQuotesRuntime(host, tripsRoutes))
  return {
    [checkoutInquiryRuntimePort.id]: checkoutInquiry,
    [quotesRuntimePort.id]: runtime.then((value) => value.quotes),
    [quotesProposalRuntimePort.id]: runtime.then((value) => value.proposal),
    [quotesSnapshotRuntimePort.id]: runtime.then((value) => value.snapshot),
    [customFieldValueLifecycleRuntimePort.id]: quoteCustomFieldValues,
  }
}

export interface QuotesRuntimeContribution {
  quotes: QuotesRuntime
  proposal: QuotesProposalRuntime
  snapshot: QuotesSnapshotRuntime
}
