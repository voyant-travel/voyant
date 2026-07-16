import type { CustomFieldsRuntime } from "@voyant-travel/core/custom-fields"
import { resolveWorkflowEnvironment } from "@voyant-travel/db/outbox-workflow"
import { createDbClient } from "@voyant-travel/db/runtime"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { BookingRequirementsApiModuleOptions } from "./requirements/index.js"
import type {
  BookingsAccommodationRuntime,
  BookingsFinanceRuntime,
  BookingsInventoryRuntime,
  BookingsRelationshipsRuntime,
  BookingsRuntimeProvider,
} from "./runtime-port.js"
import { BOOKINGS_EXPIRE_STALE_HOLDS_RUNTIME_KEY } from "./workflow-entry.js"

interface BookingsRuntimeRequirements {
  accommodation: BookingsAccommodationRuntime
  customFields: CustomFieldsRuntime
  finance: BookingsFinanceRuntime
  relationships: BookingsRelationshipsRuntime
}

/** Compose Bookings from its host and statically selected domain providers. */
export function createBookingsRuntime(
  requirements: BookingsRuntimeRequirements,
): BookingsRuntimeProvider {
  const { accommodation, customFields, finance, relationships } = requirements

  return {
    options: {
      resolveTravelSnapshot: (db, personId, { kms }) =>
        relationships.loadPersonTravelSnapshot(db, personId, { kms }),
      resolveBillingPerson: async (db, contact, context) =>
        (
          await relationships.upsertPersonFromContact(db, contact, {
            source: context.source,
            sourceRef: context.sourceRef,
          })
        )?.id ?? null,
      resolveTravelerPerson: async (db, contact, context) =>
        (
          await relationships.upsertPersonFromContact(db, contact, {
            source: context.source,
            sourceRef: context.sourceRef,
            requireContactPoint: true,
          })
        )?.id ?? null,
      resolveBillingPersonById: async (db, personId) =>
        (await relationships.getPersonById(db, personId)) != null,
      resolveBillingOrganizationById: async (db, organizationId) =>
        (await relationships.getOrganizationById(db, organizationId)) != null,
      customFields: customFields.resolveRegistry,
      overviewItemEnrichers: { accommodation: accommodation.enrichOverviewItems },
    },
    registerWorkflowService: ({ container, bindings }) => {
      const env = resolveWorkflowEnvironment(bindings as Record<string, unknown>)
      container.register(
        BOOKINGS_EXPIRE_STALE_HOLDS_RUNTIME_KEY,
        finance.createStaleBookingHoldsRuntime({
          resolveDb: () => createWorkflowDb(env),
          userId: "system",
        }),
      )
    },
  }
}

/** Compose booking-requirements defaults from Inventory's domain provider. */
export function createBookingRequirementsRuntime(
  inventory: BookingsInventoryRuntime,
): BookingRequirementsApiModuleOptions {
  return {
    publicRoutes: { resolveProductSnapshot: inventory.resolveProductSnapshot },
  }
}

function createWorkflowDb(env: Readonly<Record<string, string | undefined>>): PostgresJsDatabase {
  if (!env.DATABASE_URL) throw new Error("Workflow runtime requires DATABASE_URL")
  return createDbClient(env.DATABASE_URL, { adapter: "node" }) as PostgresJsDatabase
}
