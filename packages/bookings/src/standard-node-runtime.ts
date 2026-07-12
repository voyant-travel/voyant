import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { createDbClient } from "@voyant-travel/db"
import { resolveWorkflowEnvironment } from "@voyant-travel/db/outbox-workflow"
import { createFinanceStaleBookingHoldsRuntime } from "@voyant-travel/finance/stale-booking-holds-runtime"
import { lazyProvider } from "@voyant-travel/hono"
import { productCapabilities, products } from "@voyant-travel/inventory/schema"
import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { BookingsRuntimePortContribution } from "./runtime-contributor.js"
import type { BookingsRuntimeProvider } from "./runtime-port.js"
import { BOOKINGS_EXPIRE_STALE_HOLDS_RUNTIME_KEY } from "./workflow-entry.js"

type ResolveCustomFields = NonNullable<BookingsRuntimeProvider["options"]["customFields"]>
type RelationshipsService = Pick<
  typeof import("@voyant-travel/relationships").relationshipsService,
  "getPersonById" | "getOrganizationById" | "loadPersonTravelSnapshot" | "upsertPersonFromContact"
>

/** Build the standard Node runtime without deployment-owned domain loaders. */
export async function createBookingsStandardNodeRuntime(
  primitives: VoyantRuntimeHostPrimitives,
): Promise<BookingsRuntimePortContribution> {
  const customFields = primitives.config.read(undefined, "customFields") as
    | ResolveCustomFields
    | undefined
  const relationshipsService = lazyProvider<RelationshipsService>(async () =>
    import("@voyant-travel/relationships").then((module) => module.relationshipsService),
  )
  const { enrichStayBookingOverviewItems } = await import(
    "@voyant-travel/accommodations/booking-overview-enricher"
  )

  return {
    bookings: {
      options: {
        resolveTravelSnapshot: (db, personId, { kms }) =>
          relationshipsService.loadPersonTravelSnapshot(db, personId, { kms }),
        resolveBillingPerson: async (db, contact, context) =>
          (
            await relationshipsService.upsertPersonFromContact(db, contact, {
              source: context.source,
              sourceRef: context.sourceRef,
            })
          )?.id ?? null,
        resolveTravelerPerson: async (db, contact, context) =>
          (
            await relationshipsService.upsertPersonFromContact(db, contact, {
              source: context.source,
              sourceRef: context.sourceRef,
              requireContactPoint: true,
            })
          )?.id ?? null,
        resolveBillingPersonById: async (db, personId) =>
          (await relationshipsService.getPersonById(db, personId)) != null,
        resolveBillingOrganizationById: async (db, organizationId) =>
          (await relationshipsService.getOrganizationById(db, organizationId)) != null,
        customFields,
        overviewItemEnrichers: { accommodation: enrichStayBookingOverviewItems },
      },
      registerWorkflowService: ({ container, bindings }) => {
        const env = resolveWorkflowEnvironment(bindings as Record<string, unknown>, process.env)
        container.register(
          BOOKINGS_EXPIRE_STALE_HOLDS_RUNTIME_KEY,
          createFinanceStaleBookingHoldsRuntime({
            resolveDb: () => createWorkflowDb(env),
            userId: "system",
          }),
        )
      },
    },
    requirements: {
      publicRoutes: { resolveProductSnapshot: resolveBookingRequirementsProductSnapshot },
    },
  }
}

async function resolveBookingRequirementsProductSnapshot(
  db: PostgresJsDatabase,
  productId: string,
) {
  const [product, capabilityRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ capability: productCapabilities.capability })
      .from(productCapabilities)
      .where(
        and(eq(productCapabilities.productId, productId), eq(productCapabilities.enabled, true)),
      ),
  ])
  if (!product) return null
  return {
    id: product.id,
    bookingMode: product.bookingMode,
    capabilities: capabilityRows.map((row) => row.capability),
  }
}

function createWorkflowDb(env: NodeJS.ProcessEnv): PostgresJsDatabase {
  if (!env.DATABASE_URL) throw new Error("Workflow runtime requires DATABASE_URL")
  return createDbClient(env.DATABASE_URL, { adapter: "node" }) as PostgresJsDatabase
}
