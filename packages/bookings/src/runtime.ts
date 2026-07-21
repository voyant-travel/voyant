import type { CustomFieldsRuntime } from "@voyant-travel/core/custom-fields"
import type { BookingRequirementsApiModuleOptions } from "./requirements/index.js"
import type {
  BookingsAccommodationRuntime,
  BookingsFinanceRuntime,
  BookingsInventoryRuntime,
  BookingsRelationshipsRuntime,
  BookingsRuntimeProvider,
} from "./runtime-port.js"

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
      resolveBillingPersonById: async (db, personId) => {
        const person = (await relationships.getPersonById(db, personId)) as {
          status?: string
          archivedAt?: unknown
        } | null
        return person?.status === "active" && person.archivedAt == null
      },
      resolveBillingOrganizationById: async (db, organizationId) => {
        const organization = (await relationships.getOrganizationById(db, organizationId)) as {
          status?: string
          archivedAt?: unknown
        } | null
        return organization?.status === "active" && organization.archivedAt == null
      },
      customFieldsForWrite: (db) => customFields.resolveRegistryForWrite(db, "booking"),
      overviewItemEnrichers: { accommodation: accommodation.enrichOverviewItems },
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
