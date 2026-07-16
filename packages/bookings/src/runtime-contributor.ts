import {
  type ActionLedgerBookingDriftRuntime,
  actionLedgerBookingDriftRuntimePort,
} from "@voyant-travel/action-ledger/runtime-port"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import {
  type CustomFieldValueLifecycleRuntime,
  customFieldValueLifecycleRuntimePort,
} from "@voyant-travel/core/runtime-port"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { checkBookingActionLedgerDrift } from "./action-ledger-drift.js"

export interface BookingsRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

const bookingCustomFieldValues: CustomFieldValueLifecycleRuntime = {
  supports: (entityType) => entityType === "booking",
  async renameDefinitionKey(db, definition, nextKey) {
    const database = db as PostgresJsDatabase
    await database.execute(
      sql`UPDATE bookings
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
      sql`UPDATE bookings
          SET custom_fields = custom_fields #- ARRAY[${definition.namespace}, ${definition.key}]::text[],
              updated_at = now()
          WHERE custom_fields -> ${definition.namespace} ? ${definition.key}`,
    )
  },
}

/** Bind Bookings-owned runtime behavior; domain behavior arrives through graph ports. */
export function createBookingsRuntimePortContribution(
  _host: BookingsRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [actionLedgerBookingDriftRuntimePort.id]: {
      checkBookingDrift: checkBookingActionLedgerDrift,
    } satisfies ActionLedgerBookingDriftRuntime,
    [customFieldValueLifecycleRuntimePort.id]: bookingCustomFieldValues,
  }
}
