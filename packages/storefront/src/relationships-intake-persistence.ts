import { relationshipsService } from "@voyant-travel/relationships"
import { customerSignals } from "@voyant-travel/relationships/schema"
import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { StorefrontRequestContext } from "./service.js"
import type { StorefrontIntakePersistence } from "./service-intake.js"

function requireStorefrontDb(context: StorefrontRequestContext): PostgresJsDatabase {
  if (!context.db) {
    throw new Error("Storefront intake requires a request database")
  }
  return context.db
}

/** Standard graph adapter from Storefront intake to the selected Relationships package. */
export function createRelationshipsStorefrontIntakePersistence(): StorefrontIntakePersistence {
  return {
    async findSignal({ context, kind, sourceSubmissionId }) {
      const db = requireStorefrontDb(context)
      const [row] = await db
        .select()
        .from(customerSignals)
        .where(
          and(
            eq(customerSignals.kind, kind),
            eq(customerSignals.sourceSubmissionId, sourceSubmissionId),
          ),
        )
        .limit(1)
      return row ?? null
    },
    createPerson({ context, data }) {
      return relationshipsService.createPerson(requireStorefrontDb(context), data)
    },
    createCustomerSignal({ context, data }) {
      return relationshipsService.createCustomerSignal(requireStorefrontDb(context), data)
    },
    updateCustomerSignal({ context, id, data }) {
      return relationshipsService.updateCustomerSignal(requireStorefrontDb(context), id, data)
    },
    deleteCustomerSignal({ context, id }) {
      return relationshipsService.deleteCustomerSignal(requireStorefrontDb(context), id)
    },
    deletePerson({ context, id }) {
      return relationshipsService.deletePerson(requireStorefrontDb(context), id)
    },
  }
}
